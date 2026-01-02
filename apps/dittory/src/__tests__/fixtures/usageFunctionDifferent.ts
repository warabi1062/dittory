import { formatValue } from "./testFunction";

// prefixが異なる値で呼ばれている
export const result1: string = formatValue("message1", "[INFO] ");
export const result2: string = formatValue("message2", "[ERROR] ");
export const result3: string = formatValue("message3", "[WARN] ");
