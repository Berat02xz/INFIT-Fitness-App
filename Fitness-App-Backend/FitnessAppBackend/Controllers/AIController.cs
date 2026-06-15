using FitnessAppBackend.Model;
using FitnessAppBackend.Model.DTO;
using FitnessAppBackend.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace FitnessAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<AIController> _logger;
        private readonly IConsumedMealService _mealService;
        public AIController(IHttpClientFactory httpClientFactory, ILogger<AIController> logger, IConsumedMealService mealService)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _mealService = mealService;
        }

        [Authorize]
        [ApiExplorerSettings(IgnoreApi = true)]
        [HttpPost("UploadMeal")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadMeal([FromForm] string UserId, [FromForm] IFormFile MealImage)
        {
            _logger.LogInformation("UploadMeal called for user {UserId}", UserId);

            if (MealImage == null || MealImage.Length == 0)
            {
                _logger.LogWarning("No file uploaded for user {UserId}", UserId);
                return BadRequest("No file uploaded.");
            }

            var apiKey = Environment.GetEnvironmentVariable("OpenAI__ApiKey");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogError("OpenAI API key not configured for user {UserId}", UserId);
                return StatusCode(500, "OpenAI API key not configured.");
            }
            else
            {
                _logger.LogDebug("OpenAI API key: {ApiKey}", apiKey);
            }
            
            // Convert file to Base64 for OpenAI
            string imageBase64;
            using (var ms = new MemoryStream())
            {
                await MealImage.CopyToAsync(ms);
                imageBase64 = Convert.ToBase64String(ms.ToArray());
            }

            // Define meal schema
            var schema = new
            {
                type = "object",
                properties = new
                {
                    isMeal = new { type = "boolean" },
                    ShortMealName = new { type = "string" },
                    CaloriesAmount = new { type = "integer" },
                    Protein = new { type = "integer" },
                    Carbs = new { type = "integer" },
                    Fat = new { type = "integer" },
                    HealthScoreOutOf10 = new { type = "integer", minimum = 1, maximum = 10 },
                    MealQuality = new
                    {
                        type = "string",
                        @enum = new[] { "Macro Rich", "Balanced Meal", "High Fat", "Consider Lighter Option", "Dairy Rich" }
                    },
                    Emojis = new
                    {
                        type = "array",
                        description = "One to four relevant food emojis representing the visible meal components. Return each emoji as a separate array item.",
                        minItems = 1,
                        maxItems = 4,
                        items = new { type = "string" }
                    }
                },
                required = new[] { "isMeal", "ShortMealName", "CaloriesAmount", "Protein", "Carbs", "Fat", "MealQuality", "HealthScoreOutOf10", "Emojis" },
                additionalProperties = false
            };



            var requestBody = new
            {
                model = "gpt-5-nano-2025-08-07",
                input = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new
                            {
                                type = "input_text",
                                text = "Estimate the meal details and return JSON. Include between one and four relevant food emojis, using separate emojis for the main visible meal components."
                            },
                            new { type = "input_image", image_url = $"data:image/jpeg;base64,{imageBase64}" }
                        }
                    }
                },
                text = new
                {
                    format = new
                    {
                        type = "json_schema",
                        name = "meal_schema",
                        schema = schema,
                        strict = true
                    }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await httpClient.PostAsync(
                "https://api.openai.com/v1/responses",
                new StringContent(json, Encoding.UTF8, "application/json")
            );

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("OpenAI API error for user {UserId}: {Error}", UserId, error);
                return StatusCode((int)response.StatusCode, error);
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            JsonNode docNode = JsonNode.Parse(responseContent);

            // 'output' is an array of messages
            var outputArray = docNode["output"]?.AsArray();
            if (outputArray == null || outputArray.Count == 0)
            {
                _logger.LogError("No output messages from AI for user {UserId}", UserId);
                return StatusCode(500, "No output from AI");
            }

            var assistantMessage = outputArray.LastOrDefault(msg => msg["role"]?.ToString() == "assistant");
            if (assistantMessage == null)
            {
                _logger.LogError("No assistant message found in AI response for user {UserId}", UserId);
                return StatusCode(500, "No assistant message found");
            }

            var contentArray = assistantMessage["content"]?.AsArray();
            if (contentArray == null || contentArray.Count == 0)
            {
                _logger.LogError("No content in assistant message for user {UserId}", UserId);
                return StatusCode(500, "No content in assistant message");
            }

            var textContent = contentArray
            .FirstOrDefault(c => c?["type"]?.ToString() == "output_text")?["text"]?.ToString();

            if (string.IsNullOrEmpty(textContent))
            {
                _logger.LogError("No usable text in assistant message for user {UserId}", UserId);
                return StatusCode(500, "No usable AI response");
            }

            // Save meal to database
            try
            {
                var mealResponse = JsonSerializer.Deserialize<MealResponse>(textContent);
                if (mealResponse == null)
                {
                    _logger.LogError("Deserialized mealResponse is null");
                    return StatusCode(500, "Failed to deserialize meal response");
                }

                mealResponse.Emojis = MealEmojiFormatter.Normalize(mealResponse.Emojis);
                var combinedEmojis = MealEmojiFormatter.Combine(mealResponse.Emojis);

                var meal = new ConsumedMeal
                {
                    UserId = Guid.Parse(UserId),
                    Name = mealResponse.ShortMealName,
                    Calories = mealResponse.CaloriesAmount,
                    Protein = mealResponse.Protein,
                    Carbohydrates = mealResponse.Carbs,
                    Fats = mealResponse.Fat,
                    MealQuality = mealResponse.MealQuality,
                    HealthScoreOutOf10 = mealResponse.HealthScoreOutOf10,
                    CreatedAt = DateTime.UtcNow,
                    OneEmoji = combinedEmojis
                };

                await _mealService.AddAsync(meal);
                
                _logger.LogInformation("Meal saved successfully for user {UserId}", UserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to deserialize and save meal for user {UserId}", UserId);
                return StatusCode(500, "Failed to save meal data");
            }

            // Return validated and normalized JSON to the frontend.
            try
            {
                var mealResponse = JsonSerializer.Deserialize<MealResponse>(textContent);
                if (mealResponse == null)
                {
                    return StatusCode(500, "Failed to deserialize meal response");
                }

                mealResponse.Emojis = MealEmojiFormatter.Normalize(mealResponse.Emojis);
                var normalizedJson = JsonSerializer.Serialize(mealResponse);
                _logger.LogInformation("Returning normalized meal JSON: {Json}", normalizedJson);
                return Content(normalizedJson, "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse AI JSON output for user {UserId}", UserId);
                return StatusCode(500, "Invalid JSON from AI");
            }
        }

        [Authorize]
        [HttpPost("AskChat")]
        public async Task AskChat([FromBody] ChatRequest chatRequest)
        {
            Console.WriteLine($"[AskChat] Called with question: {chatRequest.Question}");

            if (string.IsNullOrWhiteSpace(chatRequest.Question))
            {
                Console.WriteLine("[AskChat] Empty question received");
                Response.StatusCode = 400;
                await Response.WriteAsync("Question cannot be empty.");
                return;
            }

            var apiKey = Environment.GetEnvironmentVariable("OpenAI__ApiKey");

            var requestBody = new
            {
                model = "gpt-5-nano-2025-08-07",
                stream = true,
                input = new[]
                {
                    new
                    {
                        role = "system",
                        content = new object[]
                        {
                            new {
                                type = "input_text",
                                text =
                                "You are a fitness assistant. All responses must be valid HTML. " +
                                "RULES: " +
                                "1. Output ONLY HTML elements. No Markdown. " +
                                "2. Allowed tags: <p>, <b>, <i>, <h1>, <table>, <tr>, <td>. " +
                                "3. For tables, use <table>, <tr> and <td> tags always. " +
                                "4. Wrap food names in <food>…</food>. " +
                                "5. Wrap exercise names in <exercise>…</exercise>. " +
                                "6. Keep responses short."
                            }
                        }
                    },
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "input_text", text = chatRequest.Question }
                        }
                    }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            Console.WriteLine($"[AskChat] Sending to OpenAI:\n{json}");

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[AskChat] OpenAI API error: {error}");
                Response.StatusCode = (int)response.StatusCode;
                await Response.WriteAsync(error);
                return;
            }

            // Set up SSE response headers
            Response.ContentType = "text/event-stream";
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            // Batching configuration to reduce bandwidth usage
            const int BATCH_CHAR_THRESHOLD = 40;  // Send after accumulating this many characters
            const int BATCH_TIME_MS = 350;        // Or after this many milliseconds
            var textBuffer = new StringBuilder();
            var lastFlushTime = DateTime.UtcNow;

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();

                if (string.IsNullOrWhiteSpace(line))
                    continue;

                if (!line.StartsWith("data: "))
                    continue;

                var jsonPart = line.Substring("data: ".Length).Trim();

                if (jsonPart == "[DONE]")
                {
                    // Flush any remaining buffered text before finishing
                    if (textBuffer.Length > 0)
                    {
                        var batchedJson = JsonSerializer.Serialize(new { type = "response.output_text.delta", delta = textBuffer.ToString() });
                        await Response.WriteAsync($"data: {batchedJson}\n\n");
                        await Response.Body.FlushAsync();
                        textBuffer.Clear();
                    }
                    
                    Console.WriteLine("[AskChat] Stream finished ([DONE])");
                    await Response.WriteAsync("data: [DONE]\n\n");
                    await Response.Body.FlushAsync();
                    break;
                }

                // Extract delta text from the chunk
                string? deltaText = null;
                try
                {
                    var node = JsonNode.Parse(jsonPart);
                    if (node?["type"]?.ToString() == "response.output_text.delta")
                    {
                        deltaText = node["delta"]?.ToString();
                    }
                    else
                    {
                        // Non-delta events (like response.completed) - forward immediately
                        await Response.WriteAsync($"data: {jsonPart}\n\n");
                        await Response.Body.FlushAsync();
                        continue;
                    }
                }
                catch
                {
                    // If parsing fails, forward as-is
                    await Response.WriteAsync($"data: {jsonPart}\n\n");
                    await Response.Body.FlushAsync();
                    continue;
                }

                if (!string.IsNullOrEmpty(deltaText))
                {
                    textBuffer.Append(deltaText);
                    var timeSinceLastFlush = (DateTime.UtcNow - lastFlushTime).TotalMilliseconds;

                    // Flush if we've accumulated enough characters or enough time has passed
                    if (textBuffer.Length >= BATCH_CHAR_THRESHOLD || timeSinceLastFlush >= BATCH_TIME_MS)
                    {
                        var batchedJson = JsonSerializer.Serialize(new { type = "response.output_text.delta", delta = textBuffer.ToString() });
                        Console.WriteLine($"[AskChat] Sending batched chunk ({textBuffer.Length} chars): {textBuffer}");
                        
                        await Response.WriteAsync($"data: {batchedJson}\n\n");
                        await Response.Body.FlushAsync();
                        
                        textBuffer.Clear();
                        lastFlushTime = DateTime.UtcNow;
                    }
                }
            }
        }


    }
}
