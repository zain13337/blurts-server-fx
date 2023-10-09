/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { request, Page } from "@playwright/test";
import { InternalServerError } from "../../utils/error.js";

enum ENV {
  local = "local",
  stage = "stage",
  prod = "prod",
  dev = "dev",
}

export const defaultScreenshotOpts = {
  animations: "disabled",
  maxDiffPixelRatio: 0.04,
};

export const ENV_URLS = {
  local: "http://localhost:6060",
  dev: "https://fx-breach-alerts.herokuapp.com",
  stage: "https://stage.firefoxmonitor.nonprod.cloudops.mozgcp.net",
  prod: "https://monitor.firefox.com/",
};

export const setEnvVariables = (email: string) => {
  process.env["E2E_TEST_ENV"] = (process.env.E2E_TEST_ENV as string) ?? "local";
  process.env["E2E_TEST_ACCOUNT_EMAIL"] = email;
  process.env["E2E_TEST_BASE_URL"] =
    ENV_URLS[process.env.E2E_TEST_ENV as ENV] ??
    "https://stage.firefoxmonitor.nonprod.cloudops.mozgcp.net";
};

export const getBaseUrl = () => {
  return ENV_URLS[process.env.E2E_TEST_ENV as ENV] || ENV_URLS.local;
};

export const getVerificationCode = async (
  testEmail: string,
  page: Page,
  attempts = 10
): Promise<string> => {
  if (attempts === 0) {
    throw new InternalServerError("Unable to retrieve restmail data");
  }

  const context = await request.newContext();
  const res = await context.get(`http://restmail.net/mail/${testEmail}`, {
    failOnStatusCode: false,
  });
  const resJson = await res.json();
  if (resJson.length) {
    const verificationCode = resJson[0].headers["x-verify-short-code"];
    return verificationCode as string;
  }

  await page.waitForTimeout(1000);
  return getVerificationCode(testEmail, page, attempts - 1);
};

const enterYourEmail = async (page: Page) => {
  const maybeEmailInput = 'input[name="email"]';
  await page.waitForSelector(maybeEmailInput, { timeout: 2000 });
  const signInButton = page.locator("#submit-btn");
  await page
    .locator(maybeEmailInput)
    .fill(process.env.E2E_TEST_ACCOUNT_EMAIL_FREE as string);
  await signInButton.click({ force: true });
  await page.waitForTimeout(500);
  await checkAuthState(page);
};

const enterYourPassword = async (page: Page) => {
  await page
    .locator("#password")
    .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);

  // using force here due to fxa issue with playwright
  await page.locator("#submit-btn").click();
  await page.waitForTimeout(500);
  await checkAuthState(page);
};

export const checkAuthState = async (page: Page) => {
  const authStateTitleString = await page
    .locator("h1")
    .textContent({ timeout: 4000 });
  const checkIfTitleContains = (potentialTitle: string) => {
    return authStateTitleString?.includes(potentialTitle);
  };

  switch (true) {
    case checkIfTitleContains("Enter your email"):
      await enterYourEmail(page);
      break;
    case checkIfTitleContains("Enter your password"):
      await enterYourPassword(page);
      break;
    // case checkIfTitleContains('Set your password'):
    //   await setYourPassword(page)
    //   break
    // case checkIfTitleContains('Enter confirmation code'):
    //   await enterConfirmationCode(page)
    //   break
    // case checkIfTitleContains('Sign in'):
    //   await signIn(page)
    //   break
    default:
      break;
  }
};