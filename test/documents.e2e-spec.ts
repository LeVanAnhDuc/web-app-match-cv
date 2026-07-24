import { join } from 'path';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PDF_FIXTURE = join(__dirname, 'fixtures/sample.pdf');
const DOCX_FIXTURE = join(__dirname, 'fixtures/sample.docx');

interface DocumentResponseBody {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  rawText: string;
  isSaved: boolean;
  createdAt: string;
}

interface ErrorResponseBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

interface DocumentSummaryResponseBody {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  createdAt: string;
}

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDocumentIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (createdDocumentIds.length) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }
    await app.close();
  });

  const track = (res: request.Response) => {
    const body = res.body as DocumentResponseBody;
    if (body?.id) createdDocumentIds.push(body.id);
    return res;
  };

  describe('POST /documents', () => {
    it('[EP] paste JD text (save=false) → 201 DocumentDto (sourceFormat=text)', async () => {
      const res = track(
        await request(app.getHttpServer()).post('/api/v1/documents').send({
          kind: 'JD',
          sourceText: 'We are hiring a Senior Backend Engineer...',
          save: false,
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        kind: 'JD',
        sourceFormat: 'text',
        rawText: 'We are hiring a Senior Backend Engineer...',
        isSaved: false,
      });
      const body = res.body as DocumentResponseBody;
      expect(body.id).toEqual(expect.any(String));
      expect(body.createdAt).toEqual(expect.any(String));
    });

    it('[EP] paste CV text with save=true + title → 201, isSaved=true', async () => {
      const res = track(
        await request(app.getHttpServer()).post('/api/v1/documents').send({
          kind: 'CV',
          sourceText: 'Experienced software engineer with 5 years...',
          save: true,
          title: 'My CV v1',
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        kind: 'CV',
        sourceFormat: 'text',
        isSaved: true,
        title: 'My CV v1',
      });
    });

    it('[EP] upload real PDF file → 201 DocumentDto (sourceFormat=pdf, rawText extracted)', async () => {
      const res = track(
        await request(app.getHttpServer())
          .post('/api/v1/documents')
          .field('kind', 'JD')
          .field('save', 'false')
          .attach('file', PDF_FIXTURE, {
            contentType: 'application/pdf',
          }),
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;
      expect(body.sourceFormat).toBe('pdf');
      expect(body.rawText).toContain('Hello matchcv PDF');
    });

    it('[EP] upload real DOCX file → 201 DocumentDto (sourceFormat=docx, rawText extracted)', async () => {
      const res = track(
        await request(app.getHttpServer())
          .post('/api/v1/documents')
          .field('kind', 'CV')
          .field('save', 'false')
          .attach('file', DOCX_FIXTURE, {
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;
      expect(body.sourceFormat).toBe('docx');
      expect(body.rawText).toContain('Apple');
    });

    it('[EP] upload wrong type .txt → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .field('kind', 'JD')
        .field('save', 'false')
        .attach('file', Buffer.from('plain text content'), {
          filename: 'resume.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
    });

    it('[EP] upload wrong type .png → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .field('kind', 'JD')
        .field('save', 'false')
        .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
          filename: 'photo.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });

    it('[EP] oversize file (>10MB, correct type) → 400', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024, 'a');
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .field('kind', 'JD')
        .field('save', 'false')
        .attach('file', big, {
          filename: 'big.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
    });

    it('[EP] paste empty text (whitespace only) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .send({ kind: 'JD', sourceText: '   ', save: false });

      expect(res.status).toBe(400);
    });

    it('[EP] save=true without title → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .send({
          kind: 'CV',
          sourceText: 'Some CV content here',
          save: true,
        });

      expect(res.status).toBe(400);
    });

    it('[DT] wrong-type + oversize combined → 400, type message wins (checked first)', async () => {
      const bigWrongType = Buffer.alloc(11 * 1024 * 1024, 'b');
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .field('kind', 'JD')
        .field('save', 'false')
        .attach('file', bigWrongType, {
          filename: 'big.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      const errorBody = res.body as ErrorResponseBody;
      const message = Array.isArray(errorBody.message)
        ? errorBody.message.join(' ')
        : errorBody.message;
      expect(message.toLowerCase()).toContain('unsupported');
      expect(message.toLowerCase()).not.toContain('too large');
    });
  });

  describe('GET /documents', () => {
    const OTHER_USER_ID = '00000000-0000-0000-0000-000000000099';
    let savedJdIds: string[];
    let unsavedJdId: string;
    let otherUserDocId: string;

    beforeAll(async () => {
      const r1 = track(
        await request(app.getHttpServer()).post('/api/v1/documents').send({
          kind: 'JD',
          sourceText: 'JD saved doc one content',
          save: true,
          title: 'Saved JD One',
        }),
      );
      const r2 = track(
        await request(app.getHttpServer()).post('/api/v1/documents').send({
          kind: 'JD',
          sourceText: 'JD saved doc two content',
          save: true,
          title: 'Saved JD Two',
        }),
      );
      const r3 = track(
        await request(app.getHttpServer()).post('/api/v1/documents').send({
          kind: 'JD',
          sourceText: 'JD unsaved doc content',
          save: false,
        }),
      );

      const body1 = r1.body as DocumentResponseBody;
      const body2 = r2.body as DocumentResponseBody;
      const body3 = r3.body as DocumentResponseBody;
      savedJdIds = [body1.id, body2.id];
      unsavedJdId = body3.id;

      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: 'candidate' },
      });
      const otherDoc = await prisma.document.create({
        data: {
          userId: OTHER_USER_ID,
          kind: 'JD',
          title: 'Other user JD',
          sourceFormat: 'text',
          rawText: 'other user content',
          isSaved: true,
        },
      });
      otherUserDocId = otherDoc.id;
    });

    afterAll(async () => {
      await prisma.document
        .delete({ where: { id: otherUserDocId } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: OTHER_USER_ID } })
        .catch(() => undefined);
    });

    it('[EP] lists saved JD docs for current user only, no rawText, ordered createdAt desc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ kind: 'JD', saved: 'true' });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      expect(Array.isArray(body)).toBe(true);

      const ids = body.map((d) => d.id);
      expect(ids).toEqual(expect.arrayContaining(savedJdIds));
      expect(ids).not.toContain(unsavedJdId);
      // per-user isolation: another user's document must never leak in
      expect(ids).not.toContain(otherUserDocId);

      for (const doc of body) {
        expect(doc).not.toHaveProperty('rawText');
        expect(doc.kind).toBe('JD');
      }

      const timestamps = body.map((d) => new Date(d.createdAt).getTime());
      const sortedDesc = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedDesc);
    });

    it('[EP] saved=false excludes the saved docs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ kind: 'JD', saved: 'false' });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      const ids = body.map((d) => d.id);
      expect(ids).toContain(unsavedJdId);
      expect(ids).not.toEqual(expect.arrayContaining(savedJdIds));
    });

    it('[EP] per-user isolation: second user document never appears for stub user, regardless of filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ kind: 'JD' });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      const ids = body.map((d) => d.id);
      expect(ids).not.toContain(otherUserDocId);
    });
  });
});
