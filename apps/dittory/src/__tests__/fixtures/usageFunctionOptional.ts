import { formatValue } from "./testFunction";

// suffixが一部で渡されていない
export const result1: string = formatValue("message1", "[INFO] ", "!");
export const result2: string = formatValue("message2", "[INFO] ");
export const result3: string = formatValue("message3", "[INFO] ", "!");
