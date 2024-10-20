import { applyRetryMechanism } from "./retryMechanism";
import { retryConfigType } from "./types";
import axios from "axios";

const retryConfig: retryConfigType[] = [
  {
    growth: "EXPONENTIAL",
    factor: 2,
    totalRetries: 4,
    initialDelay: 2,
    unit: "seconds",
  },
  {
    growth: "CONSTANT",
    totalRetries: 1,
    retryInterval: 30,
    unit: "seconds",
  },
  {
    growth: "CONSTANT",
    totalRetries: Infinity,
    retryInterval: 60,
    unit: "seconds",
  },
];

applyRetryMechanism(axios, retryConfig, {
  totalRetries: 20,
  includeTimeOuts: true,
  includeJitter: true
});

(async () => {
  const abc = await axios.get(
    "https://httpstat.us/random/500,501,500-504,504,502?sleep=5000"
  );
  console.log(abc.data);
})();
