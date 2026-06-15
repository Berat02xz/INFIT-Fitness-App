using FitnessAppBackend.Model;
using FitnessAppBackend.Model.DTO;
using FitnessAppBackend.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MealController : ControllerBase
    {
        private readonly IConsumedMealService _mealService;
        public MealController(IConsumedMealService mealService)
        {
            _mealService = mealService;
        }

        [Authorize]
        [HttpPost("AddMeal")]
        public async Task<IActionResult> AddMeal([FromBody] AddMealDTO request)
        {
            if (request == null || request.UserId == Guid.Empty)
            {
                return BadRequest("Invalid meal data.");
            }
            try
            {
                var meal = new ConsumedMeal
                {
                    UserId = request.UserId,
                    Name = request.MealName,
                    Calories = request.Calories,
                    Protein = request.Protein,
                    Carbohydrates = request.Carbohydrates,
                    Fats = request.Fats,
                    HealthScoreOutOf10 = request.HealthScoreOutOf10,
                    CreatedAt = DateTime.UtcNow,
                    OneEmoji = request.Emojis.Count > 0
                        ? MealEmojiFormatter.Combine(request.Emojis)
                        : MealEmojiFormatter.Combine([request.OneEmoji ?? MealEmojiFormatter.FallbackEmoji])
                };
                await _mealService.AddAsync(meal);
                return Ok("Meal added successfully.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        [Authorize]
        [HttpGet("GetMealsByUserId/{userId}")]
        public async Task<IActionResult> GetMealsByUserId(Guid userId)
        {
            if (userId == Guid.Empty)
            {
                return BadRequest("Invalid user ID.");
            }
            try
            {
                var meals = await _mealService.GetMealsByUserIdAsync(userId);
                if (meals == null || !meals.Any())
                {
                    return NotFound("No meals found for this user.");
                }
                return Ok(meals);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [Authorize]
        [HttpDelete("DeleteMeal/{id}")]
        public async Task<IActionResult> DeleteMeal(Guid id)
        {
            if (id == Guid.Empty)
            {
                return BadRequest("Invalid meal ID.");
            }
            try
            {
                await _mealService.DeleteAsync(id);
                return Ok("Meal deleted successfully.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }



    }
}
