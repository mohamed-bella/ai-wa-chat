const venom = require('venom-bot');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const moment = require('moment');
const downloader = require('./download');
const axios = require('axios').default;
const cheerio = require('cheerio');

// Config
const config = {
    GOOGLE_API_KEY: 'AIzaSyBaHEbbmVgxIKG9jGOHFwvFWsOPSL95nF8', // Replace with your actual Gemini API key
    PREFIX: '.',
    ADMIN_NUMBERS: ['1234567890@c.us'], // Add your number(s)
    BLOCKED_NUMBERS: []
};

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
const visionModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

venom
    .create({
        session: 'dog-trainer-bot',
        multidevice: true,
        disableWelcome: true,
    })
    .then((client) => start(client))
    .catch((error) => {
        console.log('Error creating client:', error);
    });

async function start(client) {
    console.log('🐾 Dog Trainer Bot is ready with advanced features!');

    // Send welcome message with an introduction image on first contact
    client.onMessage(async (message) => {
        try {
            if (config.BLOCKED_NUMBERS.includes(message.from)) return;

            // Check if it's the first contact
            const isUserNew = await isNewUser(message.from);
            if (isUserNew) {
                await sendWelcomeMessage(client, message.from);
                return;
            }

            // Handle messages
            handleMessage(client, message);
        } catch (error) {
            console.error('Error processing message:', error);
            await client.sendText(message.from, '❌ An error occurred while processing your request.');
        }
    });
}

const interactedUsersFile = './interactedUsers.json'; // File to store user interactions

// Function to check if user is new
async function isNewUser(userNumber) {
    try {
        // Check if the file exists
        if (!fs.existsSync(interactedUsersFile)) {
            // If file doesn't exist, create it
            await fs.writeJson(interactedUsersFile, {});
        }

        // Load the file content
        const interactedUsers = await fs.readJson(interactedUsersFile);

        // Check if user exists in the record
        if (interactedUsers[userNumber]) {
            return false; // User is not new
        }

        // Add the user to the record as new
        interactedUsers[userNumber] = { firstInteraction: moment().format() };
        await fs.writeJson(interactedUsersFile, interactedUsers);
        return true; // User is new
    } catch (error) {
        console.error('Error checking if user is new:', error);
        return false; // Default to not new to prevent repeated welcomes
    }
}

// Function to send a welcome message with introduction image
async function sendWelcomeMessage(client, recipient) {
    try {
        // Send an introductory message with an image
        await client.sendText(
            recipient,
            `🐾 Bienvenue dans le Bot d'Aide pour Dresseurs de Chiens !\n\nJe suis ici pour vous aider avec tout ce dont vous avez besoin pour dresser et prendre soin de votre chien. Envoyez-moi vos questions ou utilisez les commandes disponibles.`
        );

        // Send an image introducing the bot
        await client.sendImage(
            recipient,
            './path/to/intro_image.jpg', // Replace with path to your introduction image
            'intro_image.jpg',
            `🐶 Voici comment je peux vous aider !`
        );
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
}

// Function to handle incoming messages
async function handleMessage(client, message) {
    try {
        if (message.body.startsWith(config.PREFIX)) {
            const args = message.body.slice(config.PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            switch (command) {
                case 'help':
                    await sendHelpMessage(client, message.from);
                    break;
                
                case 'ping':
                    await client.sendText(message.from, '🟢 Bot is active!');
                    break;

                case 'yt':
                case 'youtube':
                    if (!args.length) {
                        await client.sendText(message.from, '⚠️ Please provide a YouTube URL!');
                        return;
                    }
                    await handleYouTubeDownload(client, message, args[0]);
                    break;

                case 'chat':
                    if (!args.length) {
                        await client.sendText(message.from, 'Please provide a message to chat!');
                        return;
                    }
                    await handleChatCommand(client, message.from, args.join(' '));
                    break;

                case 'analyze':
                    await handleImageAnalysis(client, message);
                    break;

                // Additional commands for dog trainers
                case 'breedinfo':
                    if (!args.length) {
                        await client.sendText(message.from, '⚠️ Please provide a dog breed to get information!');
                        return;
                    }
                    await handleBreedInfoCommand(client, message.from, args.join(' '));
                    break;

                // Add more commands as needed

                default:
                    await handleChatCommand(client, message.from, message.body);
                    break;
            }
        } else {
            await handleChatCommand(client, message.from, message.body);
        }
    } catch (error) {
        console.error('Error handling message:', error);
        await client.sendText(message.from, '❌ An error occurred while processing your request.');
    }
}

// Function to send help message
async function sendHelpMessage(client, recipient) {
    const helpMessage = `
🐾 *Dog Trainer Bot Help*

*Core Commands:*
${config.PREFIX}help - Show this message
${config.PREFIX}ping - Check bot status
${config.PREFIX}yt [url] - Download YouTube video
${config.PREFIX}chat [message] - Chat with AI
${config.PREFIX}analyze - Analyze attached image

*AI Features:*
${config.PREFIX}summarize [text] - Summarize the provided text.
${config.PREFIX}explain [topic] - Explain a topic in detail.
${config.PREFIX}joke - Get a joke from the AI.
${config.PREFIX}translate [language] [text] - Translate given text into the specified language.

*Dog Trainer Tools:*
${config.PREFIX}breedinfo [breed] - Get information about a dog breed.

*Supported URLs:*
- youtube.com/...
- youtu.be/...
    `.trim();

    await client.sendText(recipient, helpMessage);
}

// Function to handle breed information command
async function handleBreedInfoCommand(client, from, breed) {
    try {
        const breedInfo = await scrapeBreedInfo(breed);
        await client.sendText(from, breedInfo);
    } catch (error) {
        console.error('Error fetching breed info:', error);
        await client.sendText(from, '❌ Unable to fetch information for the specified dog breed.');
    }
}

// Function to scrape dog breed information
async function scrapeBreedInfo(breed) {
    try {
        const url = `https://example.com/dog-breeds/${breed.toLowerCase().replace(' ', '-')}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Example: Scraping breed information
        const info = $('div.breed-info').text().trim();

        return info || 'No information found for the specified dog breed.';
    } catch (error) {
        console.error('Error scraping breed info:', error);
        throw error;
    }
}

// Function to handle AI chat command
async function handleChatCommand(client, from, userMessage) {
    try {
        const chat = model.startChat({
            history: []
        });
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        await client.sendText(from, response.text());
    } catch (error) {
        console.error('Error processing chat command:', error);
        await client.sendText(from, '❌ An error occurred while processing your request.');
    }
}

// Function to handle image analysis
async function handleImageAnalysis(client, message) {
    if (message.hasMedia) {
        try {
            const media = await client.decryptFile(message);
            const base64Data = media.toString('base64');
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: message.mimetype
                }
            };
            const analysisResult = await visionModel.generateContent([
                "Analyze this image in detail and describe what you see.",
                imagePart
            ]);
            const analysisResponse = await analysisResult.response;
            await client.sendText(message.from, `📸 *Image Analysis*\n\n${analysisResponse.text()}`);
        } catch (error) {
            console.error('Error analyzing image:', error);
            await client.sendText(message.from, '❌ An error occurred while analyzing the image.');
        }
    } else {
        await client.sendText(message.from, 'Please attach an image to analyze!');
    }
}

// Handle YouTube video download
async function handleYouTubeDownload(client, message, url) {
    // Implement YouTube download logic as per your downloader module
    // Example implementation:
    try {
        await client.sendText(message.from, '🎥 Processing YouTube download...');
        const result = await downloader.download(url); // Implement this function
        // Handle result and send appropriate responses
    } catch (error) {
        console.error('Error downloading YouTube video:', error);
        await client.sendText(message.from, '❌ Unable to download the YouTube video.');
    }
}

// Start the bot
