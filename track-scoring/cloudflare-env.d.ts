declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    JUDGE_LOGIN_ID?: string;
    JUDGE_PASSWORD_HASH?: string;
  }
}
