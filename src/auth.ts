
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pool from "@/lib/pg";
import { z } from "zod";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
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
                        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
                        const user = result.rows[0];

                        if (!user) {
                            console.log(`[AUTH] User not found: ${email}`);
                            return null;
                        }

                        if (!user.password_hash) {
                            console.log(`[AUTH] No password hash for: ${email}`);
                            return null;
                        }

                        const passwordsMatch = await bcrypt.compare(password, user.password_hash);

                        if (passwordsMatch) {
                            let establishmentUai = user.establishment_uai;

                            // --- SELF-HEALING: Repair missing UAI for students via class_id ---
                            if (user.role === 'student' && !establishmentUai && user.class_id) {
                                console.log(`[AUTH-SELF-HEALING] Missing UAI for student ${user.email}. Attempting repair via class ${user.class_id}...`);
                                try {
                                    const classRes = await pool.query('SELECT establishment_uai FROM classes WHERE id = $1', [user.class_id]);
                                    if (classRes.rows.length > 0 && classRes.rows[0].establishment_uai) {
                                        establishmentUai = classRes.rows[0].establishment_uai;
                                        // Persist repair in DB
                                        await pool.query('UPDATE users SET establishment_uai = $1 WHERE uid = $2', [establishmentUai, user.uid]);
                                        console.log(`[AUTH-SELF-HEALING] Successfully repaired UAI for ${user.email} -> ${establishmentUai}`);
                                    }
                                } catch (repairError) {
                                    console.error(`[AUTH-SELF-HEALING] Error during UAI repair for ${user.email}:`, repairError);
                                }
                            }

                            return {
                                id: user.uid || user.id,
                                email: user.email,
                                role: user.role, // Role comes directly from DB
                                establishment_uai: establishmentUai,
                                name: (user.first_name && user.last_name) ? `${user.first_name} ${user.last_name}` : user.email,
                                must_change_password: user.must_change_password // Expose flag
                            };
                        } else {
                            console.log(`[AUTH] Invalid password for: ${email}`);
                            return null;
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

