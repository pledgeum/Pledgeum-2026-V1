
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        role?: string
        establishment_uai?: string
        must_change_password?: boolean
    }
    interface Session {
        user: {
            id: string
            role: string
            establishment_uai?: string
            must_change_password?: boolean
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: string
        establishment_uai?: string
        must_change_password?: boolean
    }
}
