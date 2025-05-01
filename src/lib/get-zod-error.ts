import { ZodError } from "zod";

/**
 * Function to get the error message from zod
 * @param error
 * @returns
 */

async function getZodError(error: any) {
  if (error instanceof ZodError) {
    throw error.issues.shift()?.message;
  }
  throw error;
}

export { getZodError };
