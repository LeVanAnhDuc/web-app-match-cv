import { BadRequestException } from "@nestjs/common";
import { DOCX_MIME } from "./parsing";
import { MAX_FILE_SIZE_BYTES, createUploadFilePipe } from "./upload-file-pipe";

function upload(size: number, mimetype = DOCX_MIME): Express.Multer.File {
  return { size, mimetype, originalname: "cv.docx" } as Express.Multer.File;
}

describe("createUploadFilePipe", () => {
  it("accepts a file of exactly the 10 MB limit, matching the client", async () => {
    const file = upload(MAX_FILE_SIZE_BYTES);
    await expect(createUploadFilePipe().transform(file)).resolves.toBe(file);
  });

  it("rejects one byte over the limit with fileTooLarge", async () => {
    await expect(
      createUploadFilePipe().transform(upload(MAX_FILE_SIZE_BYTES + 1))
    ).rejects.toThrow(
      new BadRequestException("File is too large. Maximum size is 10MB.")
    );
  });

  it("reports the type error first when a file is both wrong-typed and too large", async () => {
    await expect(
      createUploadFilePipe().transform(
        upload(MAX_FILE_SIZE_BYTES + 1, "image/png")
      )
    ).rejects.toThrow("Unsupported file type. Only PDF and DOCX are allowed.");
  });

  it("lets a request without a file through", async () => {
    await expect(createUploadFilePipe().transform(undefined)).resolves.toBe(
      undefined
    );
  });
});
