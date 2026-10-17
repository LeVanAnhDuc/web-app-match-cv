import type { ApiClient } from "@/api";
import { serverMessage } from "@/data/copy";
import {
  CREDENTIAL_FIELDS,
  FAKE_KEY,
  FAKE_KEY_LAST4,
  KEY_MAX,
  KEY_MIN,
  KEY_PREFIX,
  LABEL_MAX,
  MODEL_MAX,
  ROTATED_KEY,
  SECRET_FIELDS,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// POST /ai-credentials: validation, response shape, secrecy, storage, label uniqueness
// (REQ-AICREDENTIALS-17, -18, -19, -20, -21). No provider is involved: creating never tests the key.

test.describe("ai-credentials — create", () => {
  let user: SeededUser;
  let api: ApiClient;

  test.beforeAll(async ({ aiCredData, apiAs }) => {
    user = await aiCredData.createSignedInUser();
    api = apiAs(user);
  });

  test.afterAll(async ({ aiCredData }) => {
    // Cascades to every credential this file created.
    await aiCredData.deleteUsers([user.userId]);
  });

  const create = (over: Record<string, unknown> = {}, client: ApiClient = api) =>
    client.aiCredentials.create({ provider: "openrouter", label: uniqueLabel(), apiKey: FAKE_KEY, ...over });

  // ── shape & secrecy ────────────────────────────────────────────────────────
  test(
    "tạo credential thành công trả 201 với đúng 10 field, không có vật liệu bí mật",
    { tag: ["@TC-AICREDENTIALS-021", "@smoke"] },
    async () => {
      const label = uniqueLabel("shape");
      const res = await create({ label: `  ${label}  ` });

      expect(res.status).toBe(201);
      const body = res.json();
      expect(Object.keys(body).sort()).toEqual([...CREDENTIAL_FIELDS].sort());
      for (const secret of SECRET_FIELDS) expect(body).not.toHaveProperty(secret);
      expect(body).toMatchObject({
        provider: "openrouter",
        label,
        keyLast4: FAKE_KEY_LAST4,
        chatModel: null,
        embedModel: null,
        lastTestStatus: null,
        lastTestedAt: null,
        lastUsedAt: null,
      });
      expect(Date.parse(body.createdAt)).not.toBeNaN();
    }
  );

  test(
    "key gửi lên không xuất hiện trong response create, update, list và lỗi validate",
    { tag: ["@TC-AICREDENTIALS-022", "@smoke"] },
    async () => {
      const created = await create();
      expect(created.status).toBe(201);
      const updated = await api.aiCredentials.update(created.json().id, { apiKey: ROTATED_KEY });
      expect(updated.status).toBe(200);
      const list = await api.aiCredentials.list();
      expect(list.status).toBe(200);
      // A rejected body that carries the key (whitespace appended) must not echo it in the error either.
      const rejected = await create({ apiKey: `${FAKE_KEY} trailing` });
      expect(rejected.status).toBe(400);

      for (const [what, res, secret] of [
        ["create", created, FAKE_KEY],
        ["update", updated, ROTATED_KEY],
        ["list", list, FAKE_KEY],
        ["list (rotated)", list, ROTATED_KEY],
        ["validation error", rejected, FAKE_KEY],
      ] as const) {
        expect(res.text, what).not.toContain(secret);
        expect(res.text, what).not.toContain(KEY_PREFIX);
      }
    }
  );

  test(
    "key lưu dạng mã hoá, hai lần lưu cùng key cho IV và ciphertext khác nhau",
    { tag: ["@TC-AICREDENTIALS-023", "@smoke"] },
    async ({ aiCredData }) => {
      const first = await create();
      const second = await create();
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const a = (await aiCredData.findCredential(first.json().id))!;
      const b = (await aiCredData.findCredential(second.json().id))!;
      const plaintext = Buffer.from(FAKE_KEY, "utf8");
      for (const row of [a, b]) {
        expect(row.encryptedKey.equals(plaintext)).toBe(false);
        expect(row.encryptedKey.includes(plaintext)).toBe(false);
        expect(row.encryptedKey.toString("utf8")).not.toContain(KEY_PREFIX);
        // AES-256-GCM: 96-bit IV, 128-bit auth tag.
        expect(row.keyIv).toHaveLength(12);
        expect(row.keyTag).toHaveLength(16);
      }
      // A fresh IV per write, so the same key never produces the same ciphertext twice.
      expect(a.keyIv.equals(b.keyIv)).toBe(false);
      expect(a.encryptedKey.equals(b.encryptedKey)).toBe(false);
    }
  );

  // ── equivalence partitions ─────────────────────────────────────────────────
  test(
    "server từ chối provider ngoài whitelist",
    { tag: ["@TC-AICREDENTIALS-065"] },
    async () => {
      for (const provider of ["anthropic", "OPENROUTER", "", null, 1]) {
        expect((await create({ provider })).status, String(provider)).toBe(400);
      }
      for (const provider of ["openrouter", "openai", "gemini"]) {
        expect((await create({ provider })).status, provider).toBe(201);
      }
    }
  );

  test(
    "server từ chối key chứa khoảng trắng, xuống dòng hoặc tab",
    { tag: ["@TC-AICREDENTIALS-066"] },
    async () => {
      for (const apiKey of [
        "sk-with a space-1234567890",
        "sk-with-newline\n1234567890",
        "sk-with-cr\r1234567890abcd",
        "sk-with-tab\t1234567890abc",
        " ".repeat(25),
      ]) {
        expect((await create({ apiKey })).status, JSON.stringify(apiKey)).toBe(400);
      }
      expect((await create({ apiKey: undefined })).status, "missing").toBe(400);
    }
  );

  test(
    "model rỗng hoặc chỉ khoảng trắng lưu thành null, model có giá trị được trim",
    { tag: ["@TC-AICREDENTIALS-067"] },
    async () => {
      const blank = await create({ chatModel: "   ", embedModel: "" });
      expect(blank.status).toBe(201);
      expect(blank.json().chatModel).toBeNull();
      expect(blank.json().embedModel).toBeNull();

      const set = await create({ chatModel: "  gpt-4o  ", embedModel: " text-embedding-3-large " });
      expect(set.status).toBe(201);
      expect(set.json().chatModel).toBe("gpt-4o");
      expect(set.json().embedModel).toBe("text-embedding-3-large");
    }
  );

  test(
    "field lạ trong body bị loại bỏ",
    { tag: ["@TC-AICREDENTIALS-068"] },
    async ({ aiCredData }) => {
      const otherUserId = await aiCredData.createUser();
      try {
        const res = await create({
          userId: otherUserId,
          keyLast4: "ZZZZ",
          lastTestStatus: "ok",
          lastUsedAt: "2020-01-01T00:00:00.000Z",
          encryptedKey: "plain",
        });
        expect(res.status).toBe(201);
        const body = res.json();
        expect(body.keyLast4).toBe(FAKE_KEY_LAST4);
        expect(body.lastTestStatus).toBeNull();
        expect(body.lastUsedAt).toBeNull();
        // Still owned by the caller, not by the userId smuggled in the body.
        expect((await api.aiCredentials.list()).json().some((c) => c.id === body.id)).toBe(true);
      } finally {
        await aiCredData.deleteUsers([otherUserId]);
      }
    }
  );

  test(
    "tên chỉ gồm khoảng trắng bị server từ chối, tên được trim trước khi kiểm độ dài",
    { tag: ["@TC-AICREDENTIALS-070"] },
    async () => {
      expect((await create({ label: "   " })).status).toBe(400);
      const padded = await create({ label: ` ${"p".repeat(LABEL_MAX)} ` });
      expect(padded.status).toBe(201);
      expect(padded.json().label).toBe("p".repeat(LABEL_MAX));
    }
  );

  // ── boundaries ─────────────────────────────────────────────────────────────
  test(
    "apiKey 19 và 401 ký tự bị từ chối, 20 và 400 ký tự được nhận",
    { tag: ["@TC-AICREDENTIALS-072"] },
    async () => {
      expect((await create({ apiKey: "k".repeat(KEY_MIN - 1) })).status).toBe(400);
      expect((await create({ apiKey: "k".repeat(KEY_MIN) })).status).toBe(201);
      expect((await create({ apiKey: "k".repeat(KEY_MAX) })).status).toBe(201);
      expect((await create({ apiKey: "k".repeat(KEY_MAX + 1) })).status).toBe(400);
    }
  );

  test(
    "label 0 và 61 ký tự bị từ chối, 1 và 60 ký tự được nhận",
    { tag: ["@TC-AICREDENTIALS-073"] },
    async () => {
      const stem = uniqueLabel("b").replace(/\s/g, "");
      expect((await create({ label: "" })).status).toBe(400);
      expect((await create({ label: stem.slice(-1) })).status).toBe(201);
      expect((await create({ label: stem.padEnd(LABEL_MAX, "x") })).status).toBe(201);
      expect((await create({ label: stem.padEnd(LABEL_MAX + 1, "y") })).status).toBe(400);
    }
  );

  test(
    "model 120 ký tự được nhận, 121 ký tự bị từ chối",
    { tag: ["@TC-AICREDENTIALS-074"] },
    async () => {
      expect((await create({ chatModel: "c".repeat(MODEL_MAX) })).status).toBe(201);
      expect((await create({ embedModel: "e".repeat(MODEL_MAX) })).status).toBe(201);
      expect((await create({ chatModel: "c".repeat(MODEL_MAX + 1) })).status).toBe(400);
      expect((await create({ embedModel: "e".repeat(MODEL_MAX + 1) })).status).toBe(400);
    }
  );

  // ── label uniqueness ───────────────────────────────────────────────────────
  test(
    "tên trùng trong cùng user trả 409 labelTaken",
    { tag: ["@TC-AICREDENTIALS-079"] },
    async () => {
      const label = uniqueLabel("dup");
      expect((await create({ label })).status).toBe(201);

      const res = await create({ label, provider: "gemini" });
      expect(res.status).toBe(409);
      expect(res.error().message).toBe(serverMessage("aiCredentials.errors.labelTaken"));
      // Uniqueness is on the stored (trimmed) label.
      expect((await create({ label: `  ${label} ` })).status).toBe(409);
    }
  );

  test(
    "user khác dùng cùng tên vẫn hợp lệ",
    { tag: ["@TC-AICREDENTIALS-082"] },
    async ({ aiCredData, apiAs }) => {
      const label = uniqueLabel("shared");
      expect((await create({ label })).status).toBe(201);
      const other = await aiCredData.createSignedInUser();
      try {
        expect((await create({ label }, apiAs(other))).status).toBe(201);
      } finally {
        await aiCredData.deleteUsers([other.userId]);
      }
    }
  );

  test(
    "hai request tạo đồng thời cùng tên: một 201, một 409",
    { tag: ["@TC-AICREDENTIALS-083"] },
    async () => {
      const label = uniqueLabel("race");
      const [a, b] = await Promise.all([create({ label }), create({ label })]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect((await api.aiCredentials.list()).json().filter((c) => c.label === label)).toHaveLength(1);
    }
  );
});
