import { Controller, Get, Res, StreamableFile } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { tMe } from "./i18n-messages";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("export")
  @ApiOkResponse({
    description:
      "A zip archive containing data.json plus the user's original uploads.",
    content: { "application/zip": {} }
  })
  async export(
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { stream, archive, filename } =
      await this.meService.buildExportArchive();
    // If the user cancels the download, stop building the archive instead of
    // finishing it into a socket nobody is reading.
    res.on("close", () => {
      if (!res.writableFinished) archive.abort();
    });
    // The filename is server-generated and contains only [a-z0-9-.], so it
    // cannot inject header content. Never build it from user data.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // The response body is the user's full PII export — never let a shared
    // cache or the browser's disk cache store it.
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(stream).setErrorHandler((err, res) => {
      if (res.headersSent) {
        // Headers are already out, so the status cannot change. `res` is
        // typed as `StreamableHandlerResponse` (destroyed/headersSent/
        // statusCode/send/end only — see file-stream/streamable-file.d.ts),
        // but at runtime it is the real Express `Response`, which also has
        // `destroy()` inherited from `http.OutgoingMessage`. Destroying the
        // socket is what makes the truncation visible to the client —
        // Nest's default handler just calls `res.end()`, a clean
        // chunked-encoding terminator that `fetch` resolves as a success
        // with a partial zip body.
        (res as unknown as { destroy: (error?: Error) => void }).destroy(err);
        return;
      }
      res.statusCode = 500;
      res.send(
        JSON.stringify({
          message: tMe(
            "me.errors.exportFailed",
            "Could not build your data export."
          )
        })
      );
    });
  }
}
