const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");

// Tăng timeout lên 30s vì các thao tác DB và gửi mail thật tốn thời gian
jest.setTimeout(30000);

describe("Kiểm thử tích hợp hệ thống - Auth Flow", () => {
  beforeAll(async () => {
    // Kết nối tới Database thật (đảm bảo MongoDB đang chạy)
    const url =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/uniflow_test";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(url);
    }
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test sau khi hoàn thành
    await User.deleteMany({ email: "an_test@example.com" });
    await mongoose.connection.close();
  });

  // 1. Test Đăng ký
  it("IT-AUTH-01: Nên lưu đúng cấu trúc user vào MongoDB khi đăng ký", async () => {
    const userData = {
      email: "an_test@example.com",
      password: "Password123",
      fullName: "Nguyen Van An",
    };

    const res = await request(app).post("/api/auth/register").send(userData);

    expect(res.status).toBe(201);

    const userInDb = await User.findOne({ email: "an_test@example.com" });
    expect(userInDb).not.toBeNull();
    expect(userInDb.fullName).toBe("Nguyen Van An");
    // Kiểm tra field mặc định như trong ảnh DB bạn gửi
    expect(Array.isArray(userInDb.notificationChannels)).toBe(true);
  });

  // 2. Test Đăng nhập
  it("IT-AUTH-02: Nên đăng nhập thành công và nhận được JWT Token", async () => {
    const loginData = {
      email: "an_test@example.com",
      password: "Password123",
    };

    const res = await request(app).post("/api/auth/login").send(loginData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  // 3. Test Middleware xác thực & Lấy Profile
  it("IT-AUTH-03: Nên lấy được thông tin cá nhân khi dùng Token hợp lệ", async () => {
    // Lấy token trước
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "an_test@example.com", password: "Password123" });

    const token = loginRes.body.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("an_test@example.com");
  });

  // 4. Test Quên mật khẩu (Tương tác logic Token trong DB)
  it("IT-AUTH-04: Nên cập nhật resetTokenHash vào DB khi yêu cầu quên mật khẩu", async () => {
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "an_test@example.com" });

    const user = await User.findOne({ email: "an_test@example.com" });
    expect(user.resetTokenHash).not.toBeNull();
    expect(user.resetTokenExpiresAt).toBeInstanceOf(Date);
  });
});
