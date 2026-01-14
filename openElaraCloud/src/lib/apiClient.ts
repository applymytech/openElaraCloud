/**
 * API Client for OpenElara Cloud
 *
 * This file provides a client-side interface for interacting with the 
 * backend Firebase Functions. It abstracts the function calls, making it
 * easier to invoke them from the frontend application.
 */

import { firebaseApp } from './firebase';
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { ImageGenParams, ChatMessage, Tool, ResearchResult } from './api'; // Assuming these types are defined in api.ts
import { getModelById, Model } from './models';

// ===========================================================================
// INITIALIZATION
// ===========================================================================

const functions = getFunctions(firebaseApp);

// Define callable functions
const aiChat = httpsCallable(functions, 'aiChat');
const generateImage = httpsCallable(functions, 'generateImage');
const researchAgent = httpsCallable(functions, 'researchAgent');

// ===========================================================================
// TYPE DEFINITIONS
// ===========================================================================

interface ChatRequest {
    modelId: string;
    provider: string; 
    messages: ChatMessage[];
    tools?: Tool[];
}

interface ImageRequest {
    modelId: string;
    provider: string; 
    params: ImageGenParams;
}

interface ResearchRequest {
    type: 'search' | 'answer' | 'crawl';
    query?: string;
    maxResults?: number;
    url?: string;
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

/**
 * Sends a chat request to the backend aiChat function.
 * 
 * @param modelId The ID of the chat model to use.
 * @param messages The sequence of messages in the chat history.
 * @param tools An optional list of tools the model can use.
 * @returns The model's response message.
 */
export async function callChatApi(modelId: string, messages: ChatMessage[], tools?: Tool[]): Promise<ChatMessage> {
    try {
        const model = await getModelById(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found.`);
        }

        const request: ChatRequest = {
            modelId: model.id,
            provider: model.provider,
            messages,
            tools,
        };

        const result: HttpsCallableResult = await aiChat(request);
        return (result.data as any).response as ChatMessage;
    } catch (error) {
        console.error("Error calling chat API:", error);
        // Return a user-friendly error message
        return {
            role: 'assistant',
            content: `> **Error:** Could not connect to the AI model. Please check your settings and try again. (${error})`,
        };
    }
}

/**
 * Sends an image generation request to the backend generateImage function.
 * 
 * @param modelId The ID of the image model to use.
 * @param params The parameters for the image generation.
 * @returns The generated image data.
 */
export async function callImageApi(modelId: string, params: ImageGenParams): Promise<any> { // Adjust return type as needed
    try {
        const model = await getModelById(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found.`);
        }

        const request: ImageRequest = {
            modelId: model.id,
            provider: model.provider,
            params,
        };

        const result: HttpsCallableResult = await generateImage(request);
        return result.data;
    } catch (error) {
        console.error("Error calling image API:", error);
        throw new Error('Failed to generate image.');
    }
}

/**
 * Sends a research request to the backend researchAgent function.
 * 
 * @param request The research request object.
 * @returns The research results.
 */
export async function callResearchApi(request: ResearchRequest): Promise<any> {
    try {
        const result: HttpsCallableResult = await researchAgent(request);
        return result.data;
    } catch (error) {
        console.error("Error calling research API:", error);
        throw new Error(`Research failed: ${error}`);
    }
}
