const fetch = require('node-fetch');

const API_ROUTE = "http://localhost:3000/api/conventions/conv_1/absences"; // Remplacer conv_1 par un vrai id plus tard si on le cible exactement

async function testPost() {
    console.log("TESTING POST API ABSENCE...");

    // Cookie session simulant un "professeur" (nécessite valid session token on localhost, mockons-le ou testons avec curl et vrai cookie si besoin)
    // Au lieu de l'auth Next Auth, on va modifier la route temporairement pour by-passer l'auth en localhost pour le test, 
    // ou lire directement le code de debug pour voir où ça casse.
}
testPost();
