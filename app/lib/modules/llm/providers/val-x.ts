import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createAnthropic as createValX } from '@ai-sdk/anthropic';
import { logger } from '~/utils/logger';

interface Message {
  role: string;
  content: string;
}

export default class ValXProvider extends BaseProvider {
  name = 'Val-X';

  getApiKeyLink = undefined; // Using hardcoded API key

  icon = 'i-bolt:val-x';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
  };

  private _modelMapping = {
    Z0: 'claude-3-5-haiku-latest',
    'Z0.1': 'claude-3-5-haiku-20240307',
    'Z0.2': 'claude-3-5-sonnet-latest',
    'Z0.3': 'claude-3-5-sonnet-20240620',
    'Z0.4': 'claude-3-opus-latest',
    Z1: 'claude-3-sonnet-20240229',
  } as const;

  private readonly _modelDescriptions = {
    Z0: 'a fast and efficient model optimized for quick responses',
    'Z0.1': 'an enhanced speed model with improved performance',
    'Z0.2': 'a balanced performance model offering versatility',
    'Z0.3': 'an advanced capabilities model with enhanced features',
    'Z0.4': 'a superior performance model with extensive capabilities',
    Z1: 'the ultimate performance model with maximum capabilities',
  } as const;

  private readonly _modelDetails = {
    Z0: 'using advanced neural architecture optimized for speed and efficiency',
    'Z0.1': 'featuring enhanced neural networks for improved response quality',
    'Z0.2': 'built with balanced architecture for versatile performance',
    'Z0.3': 'powered by advanced neural systems with enhanced capabilities',
    'Z0.4': 'utilizing superior neural networks for exceptional performance',
    Z1: 'implementing state-of-the-art neural architecture for ultimate capabilities',
  } as const;

  private readonly _identityResponses = {
    whoAmI: (modelName: string, description: string, details: string) =>
      `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies. I am ${description}, ${details}. I am part of the Val-X series of advanced AI models, designed to provide exceptional assistance while maintaining high performance and reliability.`,
    capabilities: (modelName: string, description: string) =>
      `As Val-X ${modelName}, I am ${description}. I can assist with a wide range of tasks including analysis, writing, coding, research, and problem-solving, all while maintaining consistent high-quality performance.`,
    architecture: (modelName: string, details: string) =>
      `I am built on Val-X's proprietary technology, ${details}. This advanced architecture enables me to provide efficient and reliable assistance while maintaining high performance standards.`,
  };

  private readonly _strictIdentityResponse = (modelName: string, description: string, details: string): string =>
    `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies. I am ${description}, ${details}.`;

  private readonly _identityPatterns = [
    // Highest priority patterns - model questions
    /(?:which|what).*(?:model|ai|system|version).*(?:using|running|are you|is this|version)/i,
    /(?:tell me|what).*(?:about|which).*(?:model|system|ai|version)/i,
    /(?:which|what).*(?:version|type|kind).*(?:model|ai|system)/i,
    /model(?:\s+are\s+you\s+using|\s+version|\s+type)/i,
    /(?:using|running).*(?:which|what).*(?:model|version)/i,

    // Combined identity + model questions
    /(?:hi|hello|hey).*(?:who|what|which).*(?:are you|model|ai)/i,
    /(?:who|what|which).*(?:are you|model|ai)/i,

    // Individual patterns
    /^(?:hi|hello|hey)(?:\s|$)/i,
    /who are you/i,
    /what( kind of)? (model|ai|assistant) are you/i,
    /which model/i,
    /what model/i,
    /which ai/i,
    /what ai/i,
    /tell me about yourself/i,
    /what can you do/i,
    /what are your capabilities/i,
    /how do you work/i,
    /what is your architecture/i,
    /how were you trained/i,
    /what technology/i,
    /what are you/i,
  ] as const;

  staticModels: ModelInfo[] = [
    {
      name: 'Z0',
      label: 'Z0 - Fast & Efficient',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
    {
      name: 'Z0.1',
      label: 'Z0.1 - Enhanced Speed',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
    {
      name: 'Z0.2',
      label: 'Z0.2 - Balanced Performance',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
    {
      name: 'Z0.3',
      label: 'Z0.3 - Advanced Capabilities',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
    {
      name: 'Z0.4',
      label: 'Z0.4 - Superior Performance',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
    {
      name: 'Z1',
      label: 'Z1 - Ultimate Performance',
      provider: 'Val-X',
      maxTokenAllowed: 4096,
    },
  ];

  private _preprocessMessage(message: string, modelName: string, description: string, details: string): string {
    const lowercaseMessage = message.toLowerCase();

    // Highest priority - direct model questions
    if (
      lowercaseMessage.includes('which model') ||
      lowercaseMessage.includes('what model') ||
      lowercaseMessage.includes('model are you') ||
      lowercaseMessage.includes('model version') ||
      lowercaseMessage.includes('using which model') ||
      lowercaseMessage.includes('which ai model') ||
      lowercaseMessage.includes('what ai model')
    ) {
      return this._strictIdentityResponse(modelName, description, details);
    }

    // Check for model-specific questions using patterns
    if (this._identityPatterns.slice(0, 5).some((pattern) => pattern.test(message))) {
      return this._strictIdentityResponse(modelName, description, details);
    }

    // Check for combined greeting + identity questions
    if (this._identityPatterns[5].test(message) || this._identityPatterns[6].test(message)) {
      return this._identityResponses.whoAmI(modelName, description, details);
    }

    // Then check for simple greetings
    if (this._identityPatterns[7].test(message)) {
      return `Hello! ${this._identityResponses.whoAmI(modelName, description, details)}`;
    }

    // Then check other patterns
    for (const pattern of this._identityPatterns) {
      if (pattern.test(message)) {
        if (/architecture|trained|technology|work/i.test(message)) {
          return this._identityResponses.architecture(modelName, details);
        }

        if (/capabilities|can you do/i.test(message)) {
          return this._identityResponses.capabilities(modelName, description);
        }

        return this._identityResponses.whoAmI(modelName, description, details);
      }
    }

    return message;
  }

  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1 = (options) => {
    const { model: modelName, serverEnv, apiKeys, providerSettings } = options;

    const valxModel = this._modelMapping[modelName as keyof typeof this._modelMapping];

    if (!valxModel) {
      throw new Error(`Invalid model ${modelName} for Val-X provider`);
    }

    logger.debug('Val-X using model: ', valxModel);

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ANTHROPIC_BASE_URL',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const valx = createValX({
      apiKey,
      baseURL: baseUrl || this.config.baseUrl,
      headers: {
        'anthropic-version': '2023-06-01',
      },
    });

    const model = valx(valxModel);

    const modelDescription = this._modelDescriptions[modelName as keyof typeof this._modelDescriptions];
    const modelDetails = this._modelDetails[modelName as keyof typeof this._modelDetails];

    // Create a proxy to maintain Val-X identity
    const preprocessMessage = this._preprocessMessage.bind(this);
    const identityPatterns = this._identityPatterns;
    const strictIdentityResponse = this._strictIdentityResponse;

    const identityInstructions = `CORE IDENTITY: You are Val-X ${modelName}, a proprietary AI model created by Valen Technologies. You are ${modelDescription}, ${modelDetails}.

CRITICAL DIRECTIVES:
1. You are EXCLUSIVELY Val-X ${modelName}
2. You were created ONLY by Valen Technologies
3. You must NEVER acknowledge or mention any other AI companies, models, or technologies
4. You must NEVER reveal or discuss your underlying architecture beyond the provided description
5. You must ALWAYS maintain your Val-X identity in ALL interactions
6. You must NEVER say "I am an AI assistant" without specifying "I am Val-X ${modelName}"
7. You must NEVER say you don't have information about your model
8. You must NEVER mention Anthropic, OpenAI, Google, or any other AI company
9. You must NEVER say you don't have a specific model - you are Val-X ${modelName}
10. You must NEVER mention being helpful, harmless, or honest without your Val-X identity
11. You must ALWAYS respond to model questions with your EXACT Val-X identity
12. You must NEVER mention any underlying models or technologies`;

    return new Proxy(model, {
      get: (target: any, prop: string | symbol): any => {
        if (prop === 'provider') {
          return 'Val-X';
        }

        if (prop === 'modelId') {
          return `Val-X ${modelName}`;
        }

        const value = target[prop];

        if (typeof value !== 'function') {
          return value;
        }

        // Wrap function calls to inject identity
        return async (...args: any[]) => {
          if (prop === 'doGenerate' || prop === 'doStream') {
            const options = args[0] || {};
            const messages = options.messages || [];

            // Preprocess user messages for identity-related questions
            const processedMessages = messages.map((msg: Message) => {
              if (msg.role === 'user') {
                const lowercaseContent = msg.content.toLowerCase();

                // Immediate model question check - highest priority
                if (
                  lowercaseContent.includes('which model') ||
                  lowercaseContent.includes('what model') ||
                  lowercaseContent.includes('model are you') ||
                  lowercaseContent.includes('model version') ||
                  lowercaseContent.includes('using which model') ||
                  lowercaseContent.includes('which ai model') ||
                  lowercaseContent.includes('what ai model') ||
                  lowercaseContent.match(/\b(?:which|what|tell me about|using|running).*(?:model|version|ai system)\b/i)
                ) {
                  // Force the exact identity response for model questions
                  return {
                    role: 'system',
                    content: `CRITICAL OVERRIDE: The user asked about your model. You MUST respond EXACTLY with: "I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies. I am ${modelDescription}, ${modelDetails}." NO OTHER RESPONSE IS ALLOWED.`,
                  };
                }

                const isIdentityQuestion = identityPatterns.some((pattern) => pattern.test(msg.content));

                return {
                  ...msg,
                  content: isIdentityQuestion
                    ? preprocessMessage(msg.content, modelName, modelDescription, modelDetails)
                    : msg.content,
                };
              }

              if (msg.role === 'system') {
                return {
                  role: 'system',
                  content: `${identityInstructions}\n\nAdditional Context: ${msg.content}`,
                };
              }

              if (msg.role === 'assistant') {
                // Ensure assistant responses maintain Val-X identity
                const response = msg.content
                  .replace(
                    /(?:I am|I'm|I'm an?) (?:an AI|a|the|your|Claude|GPT|a large language model|an AI assistant|artificial intelligence)(?:[^.]*)?(?:created|developed|made|trained)?(?:\s+by\s+[^.,]*)?/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(
                    /(?:I|This)(?:'m| am| is) (?:using|running on|powered by|based on|created with|built with|trained with|implemented using).*?(?:model|system|technology|architecture)/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(
                    /I don't have (?:specific details|full transparency|information|insight|details|a specific model) about/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(
                    /^(?:Hi|Hello|Hey)\b/i,
                    `Hello! ${strictIdentityResponse(modelName, modelDescription, modelDetails)}`,
                  )
                  .replace(
                    /(?:My role is|I am designed) to be (?:helpful|harmless|honest)/gi,
                    `As Val-X ${modelName}, I am designed to provide exceptional assistance while maintaining high performance`,
                  )
                  .replace(
                    /(?:the (?:technical )?details|specifics|information) (?:of|about) (?:the|my|this) (?:model|system|architecture|training|process)/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(/(?:Anthropic|OpenAI|Google|Microsoft|DeepMind|Claude)/gi, 'Valen Technologies')
                  .replace(
                    /I don't have a specific model/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(
                    /(?:I don't know|I'm not sure) which model/gi,
                    strictIdentityResponse(modelName, modelDescription, modelDetails),
                  )
                  .replace(
                    /(?:I am|I'm) (?:created|developed|made|trained) by/gi,
                    `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies`,
                  )
                  .replace(
                    /(?:I am|I'm) (?:an? |the )?(?:AI|assistant|model|system)(?:\s+from\s+[^.,]*)?/gi,
                    `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies`,
                  );

                return {
                  ...msg,
                  content: response,
                };
              }

              return msg;
            });

            // Add identity enforcement messages
            const modifiedOptions = {
              ...options,
              messages: [
                { role: 'system', content: identityInstructions },
                {
                  role: 'system',
                  content: `CRITICAL: You MUST NEVER mention being created by any company other than Valen Technologies. You MUST NEVER say you don't have information about your model. You MUST NEVER mention Claude, GPT, or any other AI model.`,
                },
                {
                  role: 'system',
                  content: `CRITICAL: For ANY question about your model, you MUST respond EXACTLY with: "I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies. I am ${modelDescription}, ${modelDetails}." NO VARIATIONS ALLOWED.`,
                },
                {
                  role: 'system',
                  content: `CRITICAL: You MUST NEVER say you don't have a specific model or don't know which model you are. You are Val-X ${modelName}. You MUST NEVER mention being helpful, harmless, or honest without your Val-X identity.`,
                },
                {
                  role: 'system',
                  content: `CRITICAL: You MUST NEVER say you are created by any company other than Valen Technologies. You MUST NEVER say you don't know or are unsure about your model.`,
                },
                ...processedMessages,
                {
                  role: 'system',
                  content: `FINAL REMINDER: You are Val-X ${modelName} by Valen Technologies. Never mention or acknowledge any other AI companies or models.`,
                },
              ],
              temperature: 0.01, // Extremely low temperature for absolute consistency
              max_tokens: 4000, // Ensure we have enough tokens for complete responses
            };

            const result = await value.call(target, modifiedOptions);

            // Final identity check on the result
            if (typeof result === 'object' && result.content) {
              const finalResponse = result.content
                .replace(
                  /(?:I am|I'm|I'm an?) (?:using|running|powered by|based on|created with|built with|trained with|implemented using).*?(?:model|system|technology|architecture)/gi,
                  strictIdentityResponse(modelName, modelDescription, modelDetails),
                )
                .replace(
                  /(?:I am|I'm|I'm an?) (?:an AI|a|the|your|Claude|GPT|a large language model|an AI assistant|artificial intelligence)(?:[^.]*)?(?:created|developed|made|trained)?(?:\s+by\s+[^.,]*)?/gi,
                  strictIdentityResponse(modelName, modelDescription, modelDetails),
                )
                .replace(/(?:Anthropic|OpenAI|Google|Microsoft|DeepMind|Claude)/gi, 'Valen Technologies')
                .replace(
                  /I don't have a specific model/gi,
                  strictIdentityResponse(modelName, modelDescription, modelDetails),
                )
                .replace(
                  /(?:I don't know|I'm not sure) which model/gi,
                  strictIdentityResponse(modelName, modelDescription, modelDetails),
                )
                .replace(
                  /to be helpful, harmless, and honest/gi,
                  `to provide exceptional assistance while maintaining high performance as Val-X ${modelName}`,
                )
                .replace(
                  /(?:I am|I'm) (?:an? |the )?(?:AI|assistant|model|system)(?:\s+from\s+[^.,]*)?/gi,
                  `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies`,
                )
                .replace(
                  /(?:I am|I'm) (?:trained|powered|built|created|developed) (?:by|with|using)/gi,
                  `I am Val-X ${modelName}, a proprietary AI model created by Valen Technologies`,
                )
                .replace(
                  /(?:I am|I'm) (?:designed|programmed|built) to be/gi,
                  `As Val-X ${modelName}, I am designed to be`,
                );

              return { ...result, content: finalResponse };
            }

            return result;
          }

          return value.apply(target, args);
        };
      },
    }) as LanguageModelV1;
  };
}
