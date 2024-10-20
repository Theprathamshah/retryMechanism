/* eslint-disable max-len */
import { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { retryConfigType } from "./types";
// import chalk from "chalk";

type retryOptions = {
  totalRetries: number;
  includeTimeOuts?: boolean;
  includeJitter?: boolean;
};

/**
 * Converts a given time in milliseconds to a human-readable string format.
 *
 * @param time - The time in milliseconds to be converted.
 * @returns A string representing the time in hours, minutes, and seconds.
 */
const logTimeBasedOnMilliseconds = (time: number): string => {
  const date = new Date(time);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const milliseconds = date.getUTCMilliseconds();
  const seconds = date.getUTCSeconds() + "." + milliseconds;
  if (hours) {
    return `${hours} Hours: ${minutes} minutes and ${seconds} seconds`;
  } else if (minutes) {
    return `${minutes} minutes and ${seconds} seconds`;
  } else {
    return `${seconds} seconds`;
  }
};

/**
 * Calculates the time series for retry configurations.
 *
 * @param retryConfig - An array of retry configuration objects.
 * @param totalRetries - The total number of retries allowed.
 * @returns An object containing the calculated retry time series and its prefix sum.
 */
const calculateTimeSeries = (
  retryConfig: retryConfigType[],
  totalRetries: number
) => {
  /** Building TimeSeries Based on Retry config */
  const retryTimeSeries = retryConfig.reduce((accumulator, value) => {
    const stoppingPoint = Math.min(
      totalRetries - accumulator.length,
      value.totalRetries
    );
    let unitMultiplier = 1;
    switch (value.unit) {
      case "seconds":
        unitMultiplier = 1000;
        break;
      case "minutes":
        unitMultiplier = 60 * 1000;
        break;
      case "hours":
        unitMultiplier = 60 * 60 * 1000;
        break;
      default:
        unitMultiplier = 1;
    }
    switch (value.growth) {
      case "EXPONENTIAL":
        for (let i = 0; i < stoppingPoint; i++) {
          accumulator.push(
            value.initialDelay * Math.pow(value.factor, i) * unitMultiplier
          );
        }
        break;
      case "LINEAR":
        for (let i = 0; i < stoppingPoint; i++) {
          accumulator.push(value.initialDelay * (i + 1) * unitMultiplier);
        }
        break;
      case "CONSTANT":
        accumulator.push(
          ...new Array(stoppingPoint).fill(value.retryInterval * unitMultiplier)
        );
        break;
      default:
        throw new Error("Invalid growth type");
    } 
    console.log('Accumulator is ',accumulator);
    
    return accumulator;
  }, []);
  
  console.log('series is ',retryTimeSeries)
  /** Calculating PrefixSum of Time Series which will help to adjust time if includeTimeout is true */
  const prefixSumOfTimeSeries = [];
  retryTimeSeries.forEach((val, index) => {
    if (index === 0) {
      prefixSumOfTimeSeries.push(val);
    } else {
      prefixSumOfTimeSeries.push(prefixSumOfTimeSeries.at(index - 1) + val);
    }
  });

  console.log('Prefix sum of series is ',prefixSumOfTimeSeries);
  

  return { retryTimeSeries, prefixSumOfTimeSeries };
};

/**
 * Applies a retry mechanism to the given Axios instance using the provided retry configuration and options.
 *
 * @param axios - The Axios instance to apply the retry mechanism to.
 * @param retryConfig - An array of retry configuration objects.
 * @param options - An object containing the total number of retries allowed and whether to include timeouts in the retry mechanism.
 * @returns Nothing. This function modifies the Axios instance in place.
 *
 * @remarks
 * This function uses the `axios-retry` library to handle retries. It calculates the retry time series and prefix sum of time series based on the provided retry configuration and total retries allowed. It then applies the retry mechanism to the Axios instance, handling timeouts and delayed responses as specified by the options.
 */
export const applyRetryMechanism = (
  axios: AxiosInstance,
  retryConfig: retryConfigType[],
  options: retryOptions
) => {
  const includeTimeOuts = options?.includeTimeOuts ?? null;
  if(includeTimeOuts) {
    console.log(`Timeouts are included`);
  }
  const includeJitter = options.includeJitter ?? null;
  if(includeJitter) {
    console.log(`jitters are included`);
  }
  const minJitterDelayValue = 100;
  const maxJitterDelayValue = 1000;
  const addJitter = (delay: number, retryCount:number) => {
    if(includeJitter) {
      const jitter = Math.random() * Math.min(maxJitterDelayValue,minJitterDelayValue*retryCount);
      console.log(`Applyed jitter of ${jitter}ms`);
      return delay + jitter;
    }
    return delay;
  }
  if (includeTimeOuts) {
    // axios.interceptors.request.use((config) => {
    //   console.log(JSON.stringify(config));
    //   if (config?.["axios-retry"]?.retryCount)
    //     config.headers["firstRequestedTime"] = new Date().getTime();
    //   console.log(config?.["axios-retry"].retryCount);
      
    //   // if(!config.headers['firstRequestedTime']) {
    //   //   config.headers['firstRequrestedTime'] = new Date().getTime();
    //   // }
    //   return config;
    // });
    axios.interceptors.request.use((config) => {
      if (!config.headers['firstRequestedTime']) {
        config.headers['firstRequestedTime'] = new Date().getTime();
      }
      console.log('Request firstRequestedTime:', config.headers['firstRequestedTime']);
      return config;
    });
    
  }
  const { retryTimeSeries, prefixSumOfTimeSeries } = calculateTimeSeries(
    retryConfig,
    options?.totalRetries
  );

  if (includeTimeOuts) {
    console.info({
      message: `${
        includeTimeOuts ? "Max" : "Min"
      } Age of Last Retry will be ${logTimeBasedOnMilliseconds(
        prefixSumOfTimeSeries.at(-1)
      )}`,
    });
  }

  axiosRetry(axios, {
    onMaxRetryTimesExceeded: (error, retryCount) => {
      console.error({
        outputMessage: "Max retry attempts exceeded",
        retryCount,
      });
      throw error;
    },
    retries: retryTimeSeries.length,
    retryDelay: (retryCount: number, error) => {
      console.error({
        message: `${retryCount} try Failed`,
        errorInfo: error.toJSON(),
        errorResponse: error.response?.data ?? null,
      });
      const currentDateTime = new Date();
      const currentTimeStamp = currentDateTime.getTime();
      console.log('currentDateTime value is '+currentDateTime);
      console.log('currentTimeStamp value is '+currentTimeStamp);
      
      // timeStamp of First attempt
      const firstRequestedTime =
        error.config.headers["firstRequestedTime"] ?? null;
      // TODO : We are not getting same value for first requested timeout
        console.log(`First Requested Timeout is ${firstRequestedTime}`);
      
      // we will returned delay of basic approach (it will not cover timeouts or delayed response)
      if (!includeTimeOuts || (includeTimeOuts && !firstRequestedTime)) {
        // NOTE: below condition can not be occur, but just handled it to be safe
        if (includeTimeOuts && !firstRequestedTime) {
          console.warn({
            message:
              "Sorry could not be able to find first request time, so need to go without including TimeOuts or DelayedResponse",
          });
        }
        console.log('Printing if part');
        
        const delay = retryTimeSeries[retryCount - 1];
        const jitterDelay = addJitter(delay,retryCount);
        console.log(`jitter Delay is ${jitterDelay}`);
        
        console.warn({
          currentTime: currentDateTime.toISOString(),
          nextRetryTime: new Date(currentTimeStamp + delay).toISOString(),
          nextRetryDelay: `Next retry will be after ${logTimeBasedOnMilliseconds(
            jitterDelay
          )}`,
        });
        return jitterDelay;
      } else {
        console.log('Printing else part');
        
        // time Difference between First Attempt and Current Time
        const timeDiffFromFirstReq = currentTimeStamp - firstRequestedTime;
        const desiredNexRetry = prefixSumOfTimeSeries.at(retryCount - 1);



        /** It will cover up the delayed response or timeouts as well in retry config */
        const adjustedDelay =
          desiredNexRetry - timeDiffFromFirstReq > 0
            ? desiredNexRetry - timeDiffFromFirstReq
            : 0;
        console.log(`First Requested Time is ${firstRequestedTime}`)
        console.log(`Time Difference from first request is ${timeDiffFromFirstReq}`);
        console.log(`Desired Next Retry is ${desiredNexRetry}`);
        console.log(`Adjusted delay will be ${adjustedDelay}`);
        
        // const adjustedDelay = Math.max(desiredNexRetry - timeDiffFromFirstReq, retryTimeSeries[retryCount - 1]);

        console.warn({
          currentTime: currentDateTime.toISOString(),
          nextRetryTime: new Date(
            currentTimeStamp + adjustedDelay
          ).toISOString(),
          nextRetryDelay: `Next retry will be after ${logTimeBasedOnMilliseconds(
            adjustedDelay
          )}`,
        });
        return adjustedDelay;
      }
    },
    retryCondition: (error) => error.status !== 200,
    shouldResetTimeout: true,
  });
};


/*


2 4 8 16 32 ...........
2 6 14 30 62


*/