import { z } from 'zod';

export const passwordSchema = z.string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule.")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule.")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.")
    .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial.");

export const validatePassword = (password: string) => {
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
        // Safe access to error messages handling potential structural differences
        const issues = result.error?.errors || (result.error as any)?.issues || [];
        const errorMessage = issues[0]?.message || "Le mot de passe ne respecte pas les critères de sécurité.";

        return {
            isValid: false,
            error: errorMessage
        };
    }
    return { isValid: true, error: null };
};
