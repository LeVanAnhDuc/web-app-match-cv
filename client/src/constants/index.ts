import { ENDPOINTS } from "./endpoints";
import { FILE } from "./fileConstraints";

/** Single grouped constants object — access via `CONSTANTS.<DOMAIN>.<KEY>`. */
const CONSTANTS = {
  ENDPOINTS,
  FILE
} as const;

export default CONSTANTS;
export { ENDPOINTS, FILE };
