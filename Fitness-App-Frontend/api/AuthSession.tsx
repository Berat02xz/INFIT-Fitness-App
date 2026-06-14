import { jwtDecode } from "jwt-decode";
import { router } from "expo-router";
import { loadStoredToken, removeToken } from "@/api/AxiosInstance";
import { FetchUserInformationAndStore } from "@/api/UserDataEndpoint";
import database from "@/database/database";
import { hydrateExpoGoActivity } from "@/database/expoGoActivityPersistence";
import { User } from "@/models/User";

type DecodedToken = {
  sub?: string;
  exp?: number;
};

const isExpired = (decoded: DecodedToken) => {
  return typeof decoded.exp === "number" && decoded.exp * 1000 <= Date.now();
};

const decodeSessionToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch (error) {
    console.error("Invalid JWT:", error);
    return null;
  }
};

export async function ensureAuthenticatedSession(): Promise<boolean> {
  const storedToken = await loadStoredToken();
  if (!storedToken) {
    return false;
  }

  const decoded = decodeSessionToken(storedToken);
  if (!decoded?.sub || isExpired(decoded)) {
    await removeToken();
    return false;
  }

  let user = await User.getUserDetails(database);
  if (!user || user.userId !== decoded.sub) {
    try {
      await FetchUserInformationAndStore(decoded.sub);
      user = await User.getUserDetails(database);
    } catch (error) {
      console.error("Unable to hydrate authenticated user:", error);
      await removeToken();
      return false;
    }
  }

  await hydrateExpoGoActivity(database, decoded.sub);
  return Boolean(user && user.userId === decoded.sub);
}

export async function routeForSession() {
  const isAuthenticated = await ensureAuthenticatedSession();
  router.replace(isAuthenticated ? "/workout" : "/WelcomeScreen");
  return isAuthenticated;
}
