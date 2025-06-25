# Cahier des charges – Bot de trading $COLLAT autonome (Solana/Raydium)

**Donneur d’ordre :** Alaeddine Ben Rhouma  
**Destinataire :**  Windsurf (SaaS IA) 

---

## 1. Objectif et contexte du projet

Développer un bot de trading automatisé pour le token $COLLAT sur la blockchain Solana, fonctionnant **localement** sur poste utilisateur **sans recours à un VPS ou backend distant**.  
Le bot doit effectuer des opérations de trading sur Raydium via le wallet de l’utilisateur (seed privée stockée localement et chiffrée), appliquer une stratégie de trading prédéfinie (paramétrable), et respecter le quota gratuit de l’API Helius.  
Le système doit fonctionner même si l’interface graphique est fermée.

---

## 2. Données et paramètres fournis

| Paramètre                           | Valeur                                                  |
|-------------------------------------|---------------------------------------------------------|
| **Adresse du token $COLLAT**        | C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ            |
| **Adresse du token USDC**           | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v            |
| **Adresse du pool Raydium**         | BtxxZetfDCpBfFJ4QVXh853BhzD4RgRKpwCXxzq1QmSM            |
| **Clé API Helius**                  | d94d81dd-f2a1-40f7-920d-0dfaf3aaf032                    |
| **Fréquence polling API**           | 10 minutes (conforme à l’offre gratuite Helius)         |
| **Pourcentage vente (hausse)**      | 10 %                                                    |
| **Pourcentage de tokens à vendre**  | 50 %                                                    |
| **Pourcentage rachat (baisse)**     | 5 %                                                     |
| **Pourcentage d’USDC à convertir**  | 100 %                                                   |
| **Slippage maximal toléré**         | 1.5 %                                                   |
| **Notifications email**             | cyranoaladin@gmail.com (optionnel, pour extension)      |
| **Mot de passe maître (test)**      | 271208                                                  |
| **Chemin de stockage local**        | Dossier utilisateur par défaut                          |
| **Plateformes supportées**          | Linux Mint                                              |

---

## 3. Exigences fonctionnelles

### 3.1. Installation et fonctionnement

- Bot installable sur Linux Mint (x64 minimum).
- Fonctionnement autonome en tâche de fond (service, daemon ou processus local), indépendant de l’interface graphique.
- Démarrage/arrêt manuel par script, commande ou dashboard local.

### 3.2. Sécurité et gestion du wallet

- Import de la seed privée au premier démarrage (jamais transmise à un serveur).
- **Stockage local chiffré** (type AES-256-GCM ou équivalent), accessible via mot de passe maître.
- Signature de toutes les transactions localement via la seed.

### 3.3. Intégration blockchain & Raydium

- Utilisation de Solana web3.js et Raydium SDK.
- Swap $COLLAT/USDC avec gestion du slippage (1.5% max).
- Vérification et gestion du solde du wallet à chaque opération.
- Récupération des prix via l’API Helius, fallback possible via RPC secondaire.

### 3.4. Gestion API Helius

- Fréquence des requêtes : 10 minutes minimum entre chaque polling (configurable).
- Blocage automatique si la limite d’API gratuite est atteinte, reprise au rétablissement du quota.

### 3.5. Stratégie de trading

- **Départ :** 100% fonds en $COLLAT.
- **Vente :** Si le prix augmente de 10 %, vendre 50 % des $COLLAT.
- **Achat :** Si le prix baisse de 5 % après une vente, racheter des $COLLAT avec 100% de l’USDC disponible.
- **Cycle :** Après chaque opération, mise à jour du prix d’entrée.
- **Paramètres** modifiables via fichier de configuration ou dashboard.

### 3.6. Historique, persistance et logs

- Stockage local de l’historique : transactions, snapshots de solde, logs d’événements.
- Historique chiffré et stocké dans le dossier utilisateur.

### 3.7. Interface utilisateur (dashboard local)

- Dashboard simple pour :
    - Modifier les paramètres principaux (seed, seuils, API key…)
    - Visualiser l’historique des opérations, soldes, statut du bot
    - Notifications locales (popups)
- Le fonctionnement du bot reste autonome, même dashboard fermé.

### 3.8. Notifications

- Notifications locales pour opérations et erreurs majeures.
- **Extension optionnelle :** notifications email (adresse fournie) ou Telegram.

---

## 4. Exigences techniques

- Stack : Node.js, TypeScript, Electron (ou alternative adaptée à Linux Mint)
- Sécurité : chiffrement fort, mot de passe maître obligatoire
- Robustesse : gestion des erreurs API, reconnexion automatique, journalisation détaillée

---

## 5. Déploiement, livraison et documentation

- Application exécutable ou installable facilement sous Linux Mint.
- Documentation utilisateur (installation, import seed, configuration des seuils).
- Guide technique pour la sécurité et la récupération des données.
- Code source complet et commenté.

---

## 6. Livrables attendus

- Code source
- Application prête à installer sur Linux Mint
- Documentation utilisateur & technique
- Guide d’utilisation du mot de passe maître
- (Optionnel) modules pour extensions notifications

---

## 7. Remarques et réserves

- **Aucune donnée confidentielle (seed, clés, historique) ne doit jamais quitter le poste utilisateur.**
- **Pas de stockage cloud, ni d’API distante autre que la blockchain/Raydium/Helius.**
- Le projet pourra évoluer vers une gestion multi-plateformes ou multi-tokens à moyen terme.

---

## 8. Questions préalables 

- Confirmez la possibilité de gérer le chiffrement et la persistance locale sous Linux Mint.
- Précisez les modules extensibles pour les notifications futures.
- Décrivez la méthode exacte de sécurisation de la seed et de l’historique.

---

