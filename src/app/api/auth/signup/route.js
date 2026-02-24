import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { signAuthToken, validateApiHeaders } from "@/lib/auth";
import User from "@/models/User";

export async function POST(req) {
  try {
    const headerCheck = validateApiHeaders(req, { requireContentType: true });
    if (!headerCheck.ok) {
      return NextResponse.json({ error: headerCheck.error }, { status: headerCheck.status });
    }

    const body = await req.json();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });

    const token = signAuthToken(user);

    const response = NextResponse.json(
      {
        message: "Signup successful",
        user: { id: String(user._id), username: user.username },
        token,
      },
      { status: 201 }
    );

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
