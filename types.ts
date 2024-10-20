/* eslint-disable max-len */

/** unitTypes for time interval delays */
export type unitTypes = "seconds" | "minutes" | "hours";

/**
 * Type representing the common retry configuration.
 *
 * @property {number} totalRetries - The total number of retries to attempt.
 * @property {unitTypes} unit - The unit of time for the retry intervals. Can be "seconds", "minutes", or "hours".
 */
type commonRetryConfigType = {
  totalRetries: number;
  unit: unitTypes;
};

/**
 * Function to generate retry configuration based on the provided parameters.
 *
 * @param {string} growth - The type of retry growth strategy. Can be "EXPONENTIAL", "LINEAR", or "CONSTANT".
 * @param {number} factor - The factor for exponential growth strategy. Ignored for linear and constant strategies.
 * @param {number} initialDelay - The initial delay before the first retry.
 * @param {number} totalRetries - The total number of retries to attempt.
 * @param {unitTypes} unit - The unit of time for the retry intervals. Can be "seconds", "minutes", or "hours".
 *
 * @returns {retryConfigType} - An object containing the generated retry configuration.
 */
export type retryConfigType =
  | ({
      growth: "EXPONENTIAL";
      factor: number;
      initialDelay: number;
    } & commonRetryConfigType)
  | ({ growth: "LINEAR"; initialDelay: number } & commonRetryConfigType)
  | ({ growth: "CONSTANT"; retryInterval: number } & commonRetryConfigType);
