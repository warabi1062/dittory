import { executeWithCallback } from "./testFunctionWithCallback";

const myCallback = (): void => {
  console.log("callback executed");
};

export function usage1(): void {
  executeWithCallback("data1", myCallback);
}

export function usage2(): void {
  executeWithCallback("data2", myCallback);
}

export function usage3(): void {
  executeWithCallback("data3", myCallback);
}
