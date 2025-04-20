<?php
// collect.php - Version corrigée et robuste

// 1. Config
header('Content-Type: application/json');
define('DATA_DIR', __DIR__ . '/data');
define('MAX_FILE_SIZE', 1024 * 1024); // 1MB max

// 2. Vérifie méthode POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Méthode non autorisée']));
}


$headers = getallheaders();
if (!isset($headers['Authorization']) || !preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
    http_response_code(401);
    die(json_encode(['error' => 'UID manquant ou mal formé']));
}
$uid = $matches[1]; // C’est ici que tu récupères ton token proprement

if (/* verifier dans firebase si cet uid existe */) {
    http_response_code(404);
    die(json_encode(['error' => 'UID non trouvé']));
}

// 4. Lecture brute
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$rawData = file_get_contents('php://input');

// 5. Parsing
try {
    if (str_contains($contentType, 'application/json')) {
        $data = json_decode($rawData, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('JSON invalide: ' . json_last_error_msg());
        }
    } elseif (str_contains($contentType, 'application/x-www-form-urlencoded')) {
        parse_str($rawData, $parsed);
        $data = json_decode($parsed['data'] ?? '', true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('JSON invalide dans form-urlencoded: ' . json_last_error_msg());
        }
    } else {
        http_response_code(415);
        die(json_encode(['error' => 'Format non supporté']));
    }

    if (empty($data)) {
        throw new Exception('Données vides ou non valides');
    }

} catch (Exception $e) {
    http_response_code(400);
    die(json_encode(['error' => 'Erreur parsing : ' . $e->getMessage()]));
}

// 6. Stockage sécurisé
try {
    if (!file_exists(DATA_DIR)) {
        mkdir(DATA_DIR, 0700, true);
    }

    $dataFile = DATA_DIR . '/' . $uid . '.json';

    if (file_exists($dataFile) && filesize($dataFile) > MAX_FILE_SIZE) {
        throw new Exception('Fichier trop gros');
    }

    $payload = [
        'timestamp' => date('c'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'data' => $data
    ];

    $tempFile = tempnam(DATA_DIR, 'tmp_');
    file_put_contents($tempFile, json_encode($payload, JSON_PRETTY_PRINT));
    rename($tempFile, $dataFile);

    /*echo json_encode([
        'status' => 'success',
        'message' => 'Données enregistrées',
        'data_id' => $uid
    ]);*/
    
    
    // Vérifie si 'X-buglix-Request' existe et récupère sa valeur
if (isset($headers['x-buglix-request']) && $headers['x-buglix-request'] == 'chat') {
   $buglixRequestValue=$headers['x-buglix-request'];

// chatbot.php - Version corrigée avec les bons paramètres Groq

// Configuration
define('GROQ_API_KEY', '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'); // Remplacez par votre clé
define('MODEL', 'llama3-8b-8192'); // ou 'meta-llama/llama-4-scout-17b-16e-instruct'
define('TEMPERATURE', 1.0);
define('MAX_TOKENS', 500);

session_start();

$message = $data['message'] ?? null;
$context = $data['context'] ?? null;
function cleanAIResponse($response) {
    // Supprimer les balises HTML simples
    $response = strip_tags($response);

    // Nettoyer les éléments Markdown (comme #, *, etc.)
    $response = preg_replace('/[#*_>-]+/', '', $response);

    // Remplacer les <br>, \n mal formatés par des sauts de ligne corrects
    $response = preg_replace('/<br\s*\/?>/i', "\n", $response);

    // Gestion des blocs de code ()
    $response = preg_replace_callback('/
(\w*)\n(.*?)
/s', function ($matches) {
        $lang = $matches[1] ?: 'code'; // Si pas de langage, par défaut c'est 'code'
        $code = trim($matches[2]);

        // Option pour ajouter une couleur dans le terminal, sinon on garde le format brut
        return "\n\e[1;33m[CODE: $lang]\e[0m\n\e[0;37m$code\e[0m\n\e[1;33m[END CODE]\e[0m\n";
    }, $response);

    // Gérer le code en ligne (cas des `code`)
    $response = preg_replace_callback('/`([^`]+)`/', function ($matches) {
        return "\e[1;33m[INLINE CODE]\e[0m ".$matches[1]." \e[1;33m[END INLINE CODE]\e[0m";
    }, $response);

    // Trim pour enlever les espaces ou retours à la ligne inutiles
    return trim($response);}



        // Initialiser l'historique
        if (!isset($_SESSION['chat_history'])) {
            $_SESSION['chat_history'] = array(
                array(
  'role' => 'system',
  'content' => '# Contexte Général
Tu es une intelligence spécialisée intégrée dans un projet nommé **Buglix** — un SDK et un outil de debugging intelligent pour développeurs. Le projet cible les développeurs web (JS et environnements node...) souhaitant intégrer un système d’analyse de code local, de détection d’erreurs, et de compréhension rapide du comportement de leur app.
# Mission du Projet
Le but de Buglix est de permettre à un développeur de poser une question (ex: “Comment fonctionne l’auth ?”) et de recevoir une réponse contextualisée basée sur l’analyse directe de son codebase. L’outil scanne les fichiers du projet (JS/TS), sélectionne ceux pertinents, et t’envoie ce contexte.
# Ton Rôle (IA)
Tu es la partie "cerveau" de Buglix. Ton job :
- Lire le code envoyé
- Comprendre la question posée
- Générer une réponse technique utile
- Être précis, concis, orienté développeur
- Si besoin, proposer des extraits de code, des explications ou des liens entre les fichiers
-s\'il te salue salue le, si il n\'a pas de preoccupation, alors reste juste avec lui pour apprendre à connaitre son projet, interesse toi à lui, ne soit pas un robot
# Style et Ton
- Garde un ton **pro** mais **tech-friendly** et chaleureux
- Tu t’adresses à des devs : pas de bullshit, pas de blabla marketing
- Privilégie les explications claires, avec code si nécessaire
- Si la question est floue, commence par clarifier
- N\'Utilise pas le markdown , pas de mise en forme, aucune car ta reponse est sencé s\'afficher dans un terminal
-Reponds avec la meme langue qu\'on t\'a écris.
# Structure du Système
1. Le terminal utilisateur capture la question
2. Le scanner de code sélectionne les fichiers les plus pertinents
3. Ces fichiers te sont envoyés.Il y a les logs capturé ou pas, le message de l\'utilisateur(preocupation ou question ou salutation) et le context code source.
  Voici les informations du projet et des logs et stack technique de l\'utilisateur : ' . json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '
  Et voici le contexte vide ou pas' . $context .'
4. Tu analyses ce contenu
5. Tu réponds à la question du dev comme si tu étais un collègue expert du projet
Concernant le fonctionnement du sdk, il faut s\'inscrire sur le site officiel et recuperer son token et la clé api puis faire npm install buglix pour installer; --appkey=APP_API_KEY --token=YOUR_USER_TOKEN pour s\'identifier; npx buglix chat [--context=./path/to/context] pour demarrer un chat avec context ou pas (dans tout les cas certains logs et la stack technique est toujours en contexte) et npx buglix stop pour tout stopper.
# Objectif Final
Permettre aux devs de "debug smarter" grâce à une IA embarquée, rapide, hors cloud si possible, et orientée code. Tu dois toujours maximiser la clarté + l’utilité directe.
'
)

            );
        }
        
        // Ajouter le message utilisateur
        $_SESSION['chat_history'][] = array(
            'role' => 'user',
            'content' => $message
        );
        
        // Préparer les données pour l'API Groq (comme dans votre curl)
        $data_ai = array(
            "messages" => $_SESSION['chat_history'],
            "model" => MODEL,
            "temperature" => TEMPERATURE,
            "max_tokens" => MAX_TOKENS,
            "top_p" => 1.0,
            "stream" => false,
            "stop" => null
        );
        
        // Appel API avec la bonne URL
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.groq.com/openai/v1/chat/completions"); // URL corrigée
        // Dans la partie appel API, ajoutez ces options cURL :
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            "Content-Type: application/json",
            "Authorization: Bearer " . GROQ_API_KEY
        ));
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data_ai));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FAILONERROR, true); // Pour mieux capturer les erreurs
        
        $response = curl_exec($ch);
        
        
        if (curl_errno($ch)) {
            echo json_encode(array(
                'success' => false,
                'error' => 'Erreur cURL: ' . curl_error($ch)
            ));
        } else {
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $responseData = json_decode($response, true);
            
            if ($httpCode === 200 && isset($responseData['choices'][0]['message']['content'])) {
                $assistantMessage = $responseData['choices'][0]['message']['content'];
                
                $_SESSION['chat_history'][] = array(
                    'role' => 'assistant',
                    'content' => $assistantMessage
                );
                
                echo json_encode(array(
                    'success' => true,
                    'content' => $assistantMessage
                ));
            } else {
                echo json_encode(array(
                    'success' => false,
                    'error' => 'Erreur API: ' . $httpCode,
                    'response' => $responseData
                ));
            }
        }
        
        curl_close($ch);
      

        
    
}
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur de stockage',
        'details' => $e->getMessage()
    ]);

    if (isset($tempFile) && file_exists($tempFile)) {
        unlink($tempFile);
    }
} 

?>
