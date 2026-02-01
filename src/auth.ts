
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pool from "@/lib/pg";
import { z } from "zod";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.establishment_uai = (user as any).establishment_uai;
                token.must_change_password = (user as any).must_change_password;
            }
            if (trigger === "update" && session?.must_change_password !== undefined) {
                token.must_change_password = session.must_change_password;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role as string;
                (session.user as any).establishment_uai = token.establishment_uai as string;
                (session.user as any).must_change_password = token.must_change_password as boolean;
            }
            return session;
        },
    },
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(1) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    try {
                        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
                        const user = result.rows[0];

                        if (!user) return null;

                        if (!user.password_hash) return null;

                        const passwordsMatch = await bcrypt.compare(password, user.password_hash);

                        if (passwordsMatch) {
                            return {
                                id: user.id || user.uid,
                                email: user.email,
                                role: user.role, // Role comes directly from DB
                                establishment_uai: user.establishment_uai,
                                name: `${user.first_name} ${user.last_name}`,
                                must_change_password: user.must_change_password // Expose flag
                            };
                        }
                    } catch (error) {
                        console.error("Auth error:", error);
                        return null;
                    }
                }
                return null;
            },
        }),
    ],
});

