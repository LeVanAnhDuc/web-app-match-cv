// Fixture data for `yarn seed:mock` — see docs/specs/seed-mock-documents/design.md.
//
// Pure data on purpose: this file never touches the database, so adding or
// editing a mock document means reading exactly one file and knowing nothing
// about Prisma. All DB interaction lives in seed-mock.ts.
//
// Every person, company, email and phone number below is invented. The domain
// is example.com (RFC 2606) so nothing here can reach a real inbox.

import { isUUID } from "class-validator";
import { DocumentKind } from "@prisma/client";

// Mock rows are recognised by a constant id prefix — the "dial" — NOT by a
// column or a title prefix. seed-mock.ts deletes by dial, which is what makes
// the clean command incapable of touching a real document while still being
// able to remove rows seeded by an OLDER version of this file. Mock and real
// data currently share the same owner (STUB_USER_ID, auth deferred), so the id
// is the only thing that separates them.
//
// The ids MUST be well-formed UUIDv4, which is why `4` and `8` appear in
// groups 3 and 4 rather than the flat zeros of STUB_USER_ID. Every write
// endpoint validates document ids with class-validator's `@IsUUID()`
// (`CreateMatchDto`, `CreateMatchRunDto`, `CreateCoverLetterDto`,
// `GenerateCvRewriteDto`, `SetDocumentParentDto`, `ComparisonQueryDto`), and
// validator.js >= 13.12 requires the version nibble to be 1-8 and the variant
// nibble to be 8/9/a/b. `10000000-0000-0000-0000-000000000001` is REJECTED:
// the mock would list fine in /cv and /jd and then 400 the moment you pressed
// "Run match". assertFixturesValid() now checks this with the very same
// validator so the trap cannot be re-set.
//
// Do NOT copy STUB_USER_ID's `00000000-0000-0000-0000-000000000001` shape as a
// precedent — it is not a valid UUID either; it simply never crosses a
// validated boundary, so it proves nothing about what the API accepts.
// Exported so seed-mock.ts can delete by dial rather than by the CURRENT id
// list: renumbering or removing a fixture must not strand the row already in
// the database, which — sharing STUB_USER_ID with real data — would then be
// indistinguishable from a real document and unreachable by the tool meant to
// remove it.
export const CV_ID_DIAL = "10000000-0000-4000-8000-";
export const JD_ID_DIAL = "20000000-0000-4000-8000-";

/**
 * Builds a mock id on the given dial. The counter is zero-padded to the full
 * 12-digit final group, so a two-digit fixture number stays a legal 36-char
 * UUID instead of overflowing to 37 characters.
 */
function mockId(dial: string, n: number): string {
  return `${dial}${String(n).padStart(12, "0")}`;
}

export type MockDocument = {
  id: string;
  kind: DocumentKind;
  /** Language the document is WRITTEN in — drives nothing but the summary output. */
  language: "vi" | "en";
  /** Short handle used in console output and in the design doc's score matrix. */
  label: string;
  title: string;
  rawText: string;
};

// CV-01 and CV-02 describe THE SAME person with THE SAME experience, one in
// Vietnamese and one in English.
//
// They do NOT score alike, and that is the finding rather than a bug: measured
// keywordScore is 60 for CV-01xJD-01 but 33 for CV-02xJD-02. Vietnamese is
// tokenized per syllable (ADR #14), so any two Vietnamese documents share a
// ~30-43% floor of generic professional syllables, versus ~5% for English — a
// wrong-role VI pair (CV-01xJD-03 = 43) outranks a right-role EN pair. VI and
// EN keyword scores are therefore NOT on the same scale. Compare within a
// language, never across. See docs/specs/seed-mock-documents/design.md §4.1 and
// docs/unfinished-features.md #5.
export const MOCK_DOCUMENTS: readonly MockDocument[] = [
  {
    id: mockId(CV_ID_DIAL, 1),
    kind: DocumentKind.CV,
    language: "vi",
    label: "CV-01",
    title: "CV — Nguyễn Minh Khang (Backend Engineer, tiếng Việt)",
    rawText: `NGUYỄN MINH KHANG
Backend Engineer — 5 năm kinh nghiệm
Hà Nội · khang.nguyen@example.com · 0901 234 567

TÓM TẮT
Backend Engineer với 5 năm kinh nghiệm xây dựng và vận hành hệ thống REST API
quy mô vừa bằng Node.js và TypeScript. Thành thạo NestJS, thiết kế cơ sở dữ liệu
PostgreSQL và tối ưu truy vấn thông qua Prisma. Có kinh nghiệm tách hệ thống
nguyên khối thành kiến trúc microservice, đóng gói bằng Docker và triển khai qua
pipeline CI/CD.

KINH NGHIỆM LÀM VIỆC

Senior Backend Engineer — Công ty Công nghệ Minh Long (2023 – nay)
- Dẫn dắt việc tách phân hệ thanh toán khỏi hệ thống nguyên khối thành một
  microservice độc lập viết bằng NestJS, giảm thời gian triển khai từ 40 phút
  xuống còn 6 phút.
- Thiết kế lại lược đồ PostgreSQL cho phân hệ đơn hàng, chuyển toàn bộ tầng
  truy cập dữ liệu sang Prisma và bổ sung chỉ mục cho 12 truy vấn chậm nhất.
- Xây dựng lớp cache bằng Redis cho các endpoint tra cứu danh mục, giảm 70%
  tải đọc lên cơ sở dữ liệu.
- Nâng độ phủ unit test của các service lõi từ 34% lên 81%.

Backend Developer — Công ty Giải pháp Số Sao Việt (2021 – 2023)
- Phát triển và bảo trì hơn 60 endpoint REST API bằng Node.js cho ứng dụng
  quản lý kho hàng.
- Viết Dockerfile và cấu hình pipeline CI/CD để tự động chạy kiểm thử rồi
  triển khai lên môi trường staging.
- Tích hợp cổng thanh toán nội địa và xử lý webhook bất đồng bộ có cơ chế
  thử lại.

KỸ NĂNG
Ngôn ngữ: TypeScript, JavaScript, SQL
Framework: NestJS, Express
Cơ sở dữ liệu: PostgreSQL, Redis, MongoDB
Công cụ: Prisma, Docker, Git, CI/CD, Jest
Khác: thiết kế REST API, kiến trúc microservice, unit test, tối ưu hiệu năng

HỌC VẤN
Đại học Bách khoa Hà Nội — Kỹ thuật Máy tính (2016 – 2020)

NGOẠI NGỮ
Tiếng Anh: đọc hiểu tài liệu kỹ thuật tốt, giao tiếp cơ bản`
  },
  {
    id: mockId(CV_ID_DIAL, 2),
    kind: DocumentKind.CV,
    language: "en",
    label: "CV-02",
    title: "CV — Khang Nguyen (Backend Engineer, English)",
    rawText: `KHANG NGUYEN
Backend Engineer — 5 years of experience
Hanoi, Vietnam · khang.nguyen@example.com · +84 901 234 567

SUMMARY
Backend Engineer with 5 years of experience building and operating mid-sized
REST API systems in Node.js and TypeScript. Strong with NestJS, PostgreSQL
schema design, and query optimisation through Prisma. Experienced in splitting
a monolith into a microservice architecture, packaging with Docker, and shipping
through CI/CD pipelines.

WORK EXPERIENCE

Senior Backend Engineer — Minh Long Technology (2023 – present)
- Led the extraction of the payments module out of the monolith into a
  standalone NestJS microservice, cutting deployment time from 40 minutes to
  6 minutes.
- Redesigned the PostgreSQL schema for the orders domain, moved the entire data
  access layer to Prisma, and added indexes for the 12 slowest queries.
- Built a Redis cache layer for catalogue lookup endpoints, reducing database
  read load by 70%.
- Raised unit test coverage of the core services from 34% to 81%.

Backend Developer — Sao Viet Digital Solutions (2021 – 2023)
- Developed and maintained over 60 REST API endpoints in Node.js for a
  warehouse management application.
- Wrote Dockerfiles and configured CI/CD pipelines to run the test suite
  automatically and deploy to staging.
- Integrated a domestic payment gateway and handled asynchronous webhooks with
  a retry mechanism.

SKILLS
Languages: TypeScript, JavaScript, SQL
Frameworks: NestJS, Express
Databases: PostgreSQL, Redis, MongoDB
Tools: Prisma, Docker, Git, CI/CD, Jest
Other: REST API design, microservice architecture, unit test, performance tuning

EDUCATION
Hanoi University of Science and Technology — Computer Engineering (2016 – 2020)

LANGUAGES
English: strong technical reading, conversational speaking`
  },
  {
    id: mockId(CV_ID_DIAL, 3),
    kind: DocumentKind.CV,
    language: "vi",
    label: "CV-03",
    title: "CV — Trần Thu Hà (Frontend Developer, tiếng Việt)",
    rawText: `TRẦN THU HÀ
Frontend Developer — 4 năm kinh nghiệm
Đà Nẵng · ha.tran@example.com · 0912 888 456

TÓM TẮT
Frontend Developer 4 năm kinh nghiệm xây dựng giao diện web bằng React và
TypeScript. Chú trọng chất lượng trải nghiệm: bố cục responsive trên mọi kích
thước màn hình, accessibility theo chuẩn WCAG, và một hệ thống thiết kế nhất
quán được tài liệu hoá bằng Storybook.

KINH NGHIỆM LÀM VIỆC

Frontend Developer — Công ty Sáng tạo Bình Minh (2022 – nay)
- Xây dựng lại toàn bộ giao diện trang quản trị bằng React và TypeScript, thay
  thế bộ mã jQuery cũ; thời gian tải trang đầu giảm từ 4,2 giây xuống 1,3 giây
  sau khi chuyển sang Vite.
- Thiết lập thư viện component dùng chung với Tailwind CSS và Storybook, hiện
  có 47 component được tài liệu hoá và dùng lại ở 3 sản phẩm.
- Quản lý trạng thái phía client bằng Zustand, thay cho lớp Redux nhiều mã lặp.
- Rà soát accessibility toàn bộ luồng thanh toán: bổ sung nhãn ARIA, thứ tự
  focus bằng bàn phím và độ tương phản màu đạt chuẩn AA.

Frontend Developer — Studio Thiết kế Hạ Long (2020 – 2022)
- Chuyển bản thiết kế Figma thành giao diện responsive cho hơn 20 trang giới
  thiệu sản phẩm.
- Phối hợp trực tiếp với designer để chốt token màu, khoảng cách và typography.

KỸ NĂNG
Ngôn ngữ: TypeScript, JavaScript, HTML, CSS
Framework: React, Next.js
Styling: Tailwind CSS, CSS Modules
Công cụ: Vite, Zustand, Storybook, Figma, Git
Khác: responsive design, accessibility (WCAG AA), design system

HỌC VẤN
Đại học Duy Tân — Thiết kế Đồ hoạ (2016 – 2020)`
  },
  {
    id: mockId(JD_ID_DIAL, 1),
    kind: DocumentKind.JD,
    language: "vi",
    label: "JD-01",
    title: "JD — Senior Backend Engineer (NestJS, tiếng Việt)",
    rawText: `TUYỂN DỤNG: SENIOR BACKEND ENGINEER (NESTJS)
Công ty Công nghệ Hải Đăng · Hà Nội · Toàn thời gian · Hybrid 3 ngày/tuần

VỀ VỊ TRÍ
Chúng tôi cần một Senior Backend Engineer tham gia đội nền tảng, phụ trách hệ
thống REST API phục vụ khoảng 200 nghìn người dùng hoạt động hàng tháng. Bạn sẽ
làm việc trực tiếp trên các service viết bằng NestJS và TypeScript, và tham gia
lộ trình chuyển dần hệ thống nguyên khối hiện tại sang kiến trúc microservice.

TRÁCH NHIỆM
- Thiết kế, phát triển và bảo trì các endpoint REST API bằng NestJS và Node.js.
- Thiết kế lược đồ cơ sở dữ liệu PostgreSQL, viết migration và tối ưu truy vấn
  chậm thông qua Prisma.
- Xây dựng và duy trì lớp cache bằng Redis cho các luồng đọc nhiều.
- Viết unit test cho toàn bộ logic nghiệp vụ mới; giữ độ phủ của service lõi
  không dưới 80%.
- Đóng gói service bằng Docker và duy trì pipeline CI/CD của đội.
- Tham gia review code và hướng dẫn kỹ thuật cho thành viên ít kinh nghiệm hơn.

YÊU CẦU BẮT BUỘC
- Tối thiểu 4 năm kinh nghiệm phát triển backend với Node.js và TypeScript.
- Kinh nghiệm thực tế với NestJS trong môi trường sản phẩm thật.
- Nắm vững PostgreSQL: thiết kế lược đồ, chỉ mục, phân tích kế hoạch truy vấn.
- Đã dùng Prisma hoặc một ORM tương đương ở quy mô sản phẩm.
- Thành thạo Docker và có kinh nghiệm cấu hình pipeline CI/CD.
- Có thói quen viết unit test, không coi kiểm thử là việc làm sau.

ĐIỂM CỘNG
- Kinh nghiệm tách hệ thống nguyên khối thành microservice.
- Kinh nghiệm với Redis, hàng đợi message, hoặc xử lý webhook bất đồng bộ.
- Đọc hiểu tài liệu kỹ thuật tiếng Anh tốt.

QUYỀN LỢI
Lương 40 – 60 triệu tuỳ năng lực · Thưởng theo hiệu quả 2 lần/năm · Bảo hiểm sức
khoẻ cho cả gia đình · Ngân sách học tập 15 triệu/năm · 15 ngày phép`
  },
  {
    id: mockId(JD_ID_DIAL, 2),
    kind: DocumentKind.JD,
    language: "en",
    label: "JD-02",
    title: "JD — Senior Backend Engineer (NestJS, English)",
    rawText: `HIRING: SENIOR BACKEND ENGINEER (NESTJS)
Hai Dang Technology · Hanoi · Full-time · Hybrid, 3 days on site

ABOUT THE ROLE
We are looking for a Senior Backend Engineer to join the platform team, owning
the REST API system that serves roughly 200,000 monthly active users. You will
work directly on services written in NestJS and TypeScript, and take part in the
roadmap to move the current monolith towards a microservice architecture.

RESPONSIBILITIES
- Design, build and maintain REST API endpoints in NestJS and Node.js.
- Design PostgreSQL schemas, write migrations, and optimise slow queries
  through Prisma.
- Build and maintain a Redis cache layer for read-heavy flows.
- Write unit test coverage for all new business logic; keep core services at or
  above 80%.
- Package services with Docker and maintain the team's CI/CD pipelines.
- Take part in code review and mentor less experienced engineers.

REQUIREMENTS
- At least 4 years of backend development experience with Node.js and
  TypeScript.
- Hands-on NestJS experience in a real production environment.
- Solid PostgreSQL knowledge: schema design, indexing, reading query plans.
- Production-scale experience with Prisma or an equivalent ORM.
- Comfortable with Docker and configuring CI/CD pipelines.
- A habit of writing unit test code, rather than treating testing as follow-up
  work.

NICE TO HAVE
- Experience extracting a microservice out of a monolith.
- Experience with Redis, message queues, or asynchronous webhook processing.
- Strong technical reading in English.

BENEFITS
Salary 40 – 60 million VND depending on experience · Performance bonus twice a
year · Family health insurance · 15 million VND annual learning budget ·
15 days paid leave`
  },
  {
    id: mockId(JD_ID_DIAL, 3),
    kind: DocumentKind.JD,
    language: "vi",
    label: "JD-03",
    title: "JD — Data Engineer (Python/Spark, tiếng Việt)",
    rawText: `TUYỂN DỤNG: DATA ENGINEER (PYTHON / SPARK)
Công ty Phân tích Dữ liệu Trường An · TP. Hồ Chí Minh · Toàn thời gian

VỀ VỊ TRÍ
Đội dữ liệu của chúng tôi đang xây dựng lại toàn bộ nền tảng data warehouse.
Chúng tôi cần một Data Engineer chịu trách nhiệm cho các pipeline ETL đưa dữ
liệu từ hàng chục nguồn nghiệp vụ về một kho dữ liệu tập trung, đủ tin cậy để
đội phân tích ra quyết định trên đó.

TRÁCH NHIỆM
- Xây dựng và vận hành pipeline ETL bằng Python và Apache Spark, xử lý khoảng
  4 tỷ dòng mỗi ngày.
- Điều phối luồng công việc bằng Airflow: lập lịch, theo dõi, xử lý chạy lại
  khi thất bại.
- Thiết kế mô hình dữ liệu cho data warehouse trên BigQuery theo lược đồ hình
  sao.
- Xây dựng tầng biến đổi dữ liệu bằng dbt, kèm kiểm thử chất lượng dữ liệu cho
  từng model.
- Thu nhận dữ liệu theo luồng thời gian thực từ Kafka.
- Viết truy vấn SQL phức tạp phục vụ đội phân tích và tối ưu chi phí truy vấn.

YÊU CẦU BẮT BUỘC
- Tối thiểu 3 năm kinh nghiệm ở vị trí Data Engineer.
- Thành thạo Python cho xử lý dữ liệu, và Apache Spark ở quy mô sản phẩm.
- Kinh nghiệm vận hành Airflow trong môi trường thật.
- Nắm vững SQL và các nguyên tắc mô hình hoá data warehouse.
- Đã làm việc với một kho dữ liệu trên cloud, ưu tiên BigQuery.

ĐIỂM CỘNG
- Kinh nghiệm với dbt và kiểm thử chất lượng dữ liệu.
- Kinh nghiệm với Kafka hoặc một nền tảng streaming tương đương.
- Hiểu biết về quản trị dữ liệu và kiểm soát chi phí trên cloud.

QUYỀN LỢI
Lương 35 – 55 triệu · Thưởng cuối năm · Bảo hiểm sức khoẻ · Ngân sách chứng chỉ
cloud · Làm việc từ xa 2 ngày/tuần`
  }
];

export const MOCK_DOCUMENT_IDS: readonly string[] = MOCK_DOCUMENTS.map(
  (doc) => doc.id
);

/**
 * Guards the mistakes a hand-maintained fixture list invites, each of which
 * fails SILENTLY rather than loudly:
 *
 * - a duplicate id makes `seed:mock` upsert the same row twice and report 6
 *   documents when the database holds 5;
 * - an empty rawText seeds a document that scores 0 against everything, which
 *   reads as an engine bug rather than as bad fixture data;
 * - an id that is not a well-formed UUID seeds fine (`Document.id` is a TEXT
 *   column) and lists fine, then makes every write endpoint reject the document
 *   with 400, because they all validate ids with `@IsUUID()`. This one already
 *   shipped once — see the dial comment at the top of this file — so it is
 *   checked with the SAME validator the DTOs use rather than a hand-rolled
 *   regex that could drift from it;
 * - an id on the wrong dial (a CV numbered 2000…) still gets deleted by
 *   `clean`, which deletes by dial and so covers both. It is rejected anyway
 *   because the dial is the one readable signal of what a row is, and a CV
 *   filed under the JD dial makes every future reader wrong.
 */
export function assertFixturesValid(): void {
  const seen = new Set<string>();
  for (const doc of MOCK_DOCUMENTS) {
    if (seen.has(doc.id)) {
      throw new Error(`Duplicate mock document id: ${doc.id}`);
    }
    seen.add(doc.id);

    if (doc.rawText.trim().length === 0) {
      throw new Error(`Mock document ${doc.label} has empty rawText.`);
    }

    if (!isUUID(doc.id, "4")) {
      throw new Error(
        `Mock document ${doc.label} has an id that is not a valid UUIDv4, so every @IsUUID() endpoint would reject it with 400: ${doc.id}`
      );
    }

    const expectedDial = doc.kind === DocumentKind.CV ? CV_ID_DIAL : JD_ID_DIAL;
    if (!doc.id.startsWith(expectedDial)) {
      throw new Error(
        `Mock document ${doc.label} is a ${doc.kind} but its id is not on the ${doc.kind} dial: ${doc.id}`
      );
    }
  }
}
