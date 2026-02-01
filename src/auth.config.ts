
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') || nextUrl.pathname.startsWith('/admin');
            const isOnUpdatePassword = nextUrl.pathname.startsWith('/auth/update-password');
            const isOnAuth = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup');

            if (isLoggedIn) {
                // FORCE PASSWORD CHANGE LOGIC
                if ((auth?.user as any).must_change_password) {
                    if (!isOnUpdatePassword) {
                        return Response.redirect(new URL('/auth/update-password', nextUrl));
                    }
                    return true; // Allow access to update password page
                }

                if (isOnAuth) {
                    return Response.redirect(new URL('/', nextUrl));
                }
                return true;
            }

            if (isOnDashboard) {
                return false; // Redirect to login
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.establishment_uai = (user as any).establishment_uai;
                token.must_change_password = (user as any).must_change_password;
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
    session: {
        strategy: "jwt",
    },
    secret: process.env.AUTH_SECRET,
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
