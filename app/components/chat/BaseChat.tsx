/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { Message } from 'ai';
import React, { type RefCallback, useCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { MODEL_LIST, PROVIDER_LIST, initializeModelList } from '~/utils/constants';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { APIKeyManager, getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';

import styles from './BaseChat.module.scss';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';

import FilePreview from './FilePreview';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { toast } from 'react-toastify';
import type { ActionAlert } from '~/types/actions';
import ChatAlert from './ChatAlert';
import { LLMManager } from '~/lib/modules/llm/manager';
import { Link } from '@remix-run/react';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  showWorkbench?: boolean;
}

interface ModelSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelList: any[];
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  isModelLoading?: string;
}

const ModelSettingsDialog = ({
  open,
  onClose,
  model,
  setModel,
  provider,
  setProvider,
  providerList,
  apiKeys,
  modelList,
  onApiKeysChange,
  isModelLoading,
}: ModelSettingsDialogProps) => {
  return (
    <DialogRoot open={open}>
      <Dialog
        onClose={onClose}
        className="bg-gradient-to-br from-[#22D3EE]/10 via-[#A78BFA]/10 to-[#E879F9]/10 w-full max-w-4xl mx-auto"
      >
        <div className="relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-[#22D3EE]/20 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-[#E879F9]/20 blur-3xl" />
          </div>

          <DialogTitle className="relative border-b border-white/10 bg-black/20 backdrop-blur-sm p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#A78BFA]">
                <div className="i-ph:gear-six-duotone text-2xl text-white" />
              </div>
              <span className="text-xl">Model Settings</span>
            </div>
          </DialogTitle>

          <DialogDescription className="relative p-6">
            <div className="space-y-8">
              {/* Provider Section */}
              <div className="space-y-4">
                <h3 className="text-base font-medium text-[#22D3EE] flex items-center gap-3">
                  <div className="i-ph:buildings-duotone text-lg" />
                  Provider Selection
                </h3>
                <div className="p-6 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
                  <ModelSelector
                    key={provider?.name + ':' + modelList.length}
                    model={model}
                    setModel={setModel}
                    modelList={modelList}
                    provider={provider}
                    setProvider={setProvider}
                    providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                    apiKeys={apiKeys}
                    modelLoading={isModelLoading}
                  />
                </div>
              </div>

              {/* API Key Section */}
              {(providerList || []).length > 0 && provider && provider.name !== 'Val-X' && (
                <div className="space-y-4">
                  <h3 className="text-base font-medium text-[#E879F9] flex items-center gap-3">
                    <div className="i-ph:key-duotone text-lg" />
                    API Configuration
                  </h3>
                  <div className="p-6 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
                    <APIKeyManager
                      provider={provider}
                      apiKey={apiKeys[provider.name] || ''}
                      setApiKey={(key) => {
                        onApiKeysChange(provider.name, key);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Footer with provider info */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between text-sm text-white/60">
                  <div className="flex items-center gap-3">
                    <div className="i-ph:info-duotone text-lg" />
                    <span>Selected Provider: {provider?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="i-ph:cube-duotone text-lg" />
                    <span>Models Available: {modelList.filter((m) => m.provider === provider?.name).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogDescription>
        </div>
      </Dialog>
    </DialogRoot>
  );
};

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      showWorkbench = true,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState(MODEL_LIST);
    const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [retryCount, setRetryCount] = useState(0);
    const [isInitialStart, setIsInitialStart] = useState(true);
    const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

    const getProviderSettings = useCallback(() => {
      let providerSettings: Record<string, IProviderSetting> | undefined = undefined;

      try {
        const savedProviderSettings = Cookies.get('providers');

        if (savedProviderSettings) {
          const parsedProviderSettings = JSON.parse(savedProviderSettings);

          if (typeof parsedProviderSettings === 'object' && parsedProviderSettings !== null) {
            providerSettings = parsedProviderSettings;
          }
        }
      } catch (error) {
        console.error('Error loading Provider Settings from cookies:', error);

        // Clear invalid cookie data
        Cookies.remove('providers');
      }

      return providerSettings;
    }, []);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        try {
          // Check for browser support
          if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
            console.warn('Speech recognition is not supported in this browser');
            toast.error('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');

            return;
          }

          // Initialize speech recognition
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();

          // Configure recognition with more robust settings
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          recognition.lang = 'en-US';

          // Add additional properties for stability
          recognition.grammars = new ((window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList)();

          const MAX_RETRIES = 3;
          let hasStartedListening = false;

          // Handle results
          recognition.onresult = (event: any) => {
            try {
              const transcript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join('');

              console.log('Speech recognition transcript:', transcript);
              setTranscript(transcript);
              setRetryCount(0);

              if (handleInputChange && transcript) {
                const syntheticEvent = {
                  target: { value: transcript },
                } as React.ChangeEvent<HTMLTextAreaElement>;
                handleInputChange(syntheticEvent);
              }
            } catch (error) {
              console.error('Error processing speech result:', error);
              stopListening();
            }
          };

          // Handle start of recognition
          recognition.onstart = () => {
            console.log('Speech recognition started');
            setIsListening(true);
            hasStartedListening = true;

            if (isInitialStart || retryCount === 0) {
              toast.success('Listening... Speak now.');
            }
          };

          // Handle audio start with better error handling
          recognition.onaudiostart = () => {
            console.log('Audio capturing started');
            setRetryCount(0);
          };

          // Handle audio end with better state management
          recognition.onaudioend = () => {
            console.log('Audio capturing ended');

            if (!hasStartedListening) {
              console.log('Audio ended before properly starting, attempting restart');

              try {
                setTimeout(() => {
                  if (isListening) {
                    recognition.start();
                  }
                }, 100);
              } catch (error) {
                console.error('Error restarting after premature audio end:', error);
                setIsListening(false);
              }
            }
          };

          // Handle end of recognition with better restart logic
          recognition.onend = () => {
            console.log('Speech recognition ended');

            if (!hasStartedListening) {
              console.log('Recognition ended before properly starting, attempting restart');

              try {
                setTimeout(() => {
                  if (isListening) {
                    recognition.start();
                  }
                }, 100);
                return;
              } catch (error) {
                console.error('Error restarting after premature end:', error);
                setIsListening(false);
              }
            }

            hasStartedListening = false;

            if (isListening && retryCount < MAX_RETRIES) {
              try {
                recognition.start();
                console.log('Restarting speech recognition');
              } catch (error) {
                console.error('Failed to restart recognition:', error);
                setIsListening(false);
                toast.error('Failed to restart speech recognition. Please try again.');
              }
            }
          };

          // Handle errors with better state management
          recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            clearRetryTimeout();
            hasStartedListening = false;

            switch (event.error) {
              case 'not-allowed':
                setIsListening(false);
                toast.error('Microphone access denied. Please allow microphone access and try again.');
                break;

              case 'no-speech':
                if (isListening && retryCount < MAX_RETRIES) {
                  setRetryCount((prev) => prev + 1);

                  const timeout = setTimeout(() => {
                    try {
                      recognition.start();
                      console.log(`Retrying speech recognition after no-speech (attempt ${retryCount + 1})`);
                    } catch (error) {
                      console.error('Failed to restart after no-speech:', error);
                    }
                  }, 100);
                  setRetryTimeout(timeout);
                } else if (retryCount >= MAX_RETRIES) {
                  setIsListening(false);
                  toast.error('No speech detected after multiple attempts. Please try again.');
                }

                break;

              default:
                setIsListening(false);
                toast.error('Speech recognition error: ' + event.error);
            }
          };

          setRecognition(recognition);

          // eslint-disable-next-line consistent-return
          return () => {
            if (recognition) {
              recognition.abort();
              setIsListening(false);
            }

            clearRetryTimeout();
          };
        } catch (error) {
          console.error('Failed to initialize speech recognition:', error);
          toast.error('Failed to initialize speech recognition. Please try again.');
          setIsListening(false);
        }
      }
    }, [handleInputChange, isListening]);

    const clearRetryTimeout = useCallback(() => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        setRetryTimeout(null);
      }
    }, [retryTimeout]);

    const startListening = useCallback(() => {
      if (recognition) {
        try {
          // Reset any existing recognition
          recognition.abort();

          // Reset the state
          setIsInitialStart(true);
          setRetryCount(0);

          setTimeout(() => {
            try {
              recognition.start();
              console.log('Starting speech recognition');
            } catch (error) {
              console.error('Error starting speech recognition:', error);
              toast.error('Error starting speech recognition. Please try again.');
              setIsListening(false);
            }
          }, 150);
        } catch (error) {
          console.error('Error aborting previous recognition:', error);
          setIsListening(false);
        }
      } else {
        toast.error('Speech recognition not initialized. Please refresh the page.');
      }
    }, [recognition]);

    const stopListening = useCallback(() => {
      if (recognition) {
        try {
          recognition.stop();
          setIsListening(false);
          console.log('Stopping speech recognition');
        } catch (error) {
          console.error('Error stopping speech recognition:', error);

          // Force reset the state
          setIsListening(false);

          try {
            recognition.abort();
          } catch (abortError) {
            console.error('Error aborting recognition:', abortError);
          }
        }
      }
    }, [recognition]);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        const providerSettings = getProviderSettings();
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);

          // Clear invalid cookie data
          Cookies.remove('apiKeys');
        }
        setIsModelLoading('all');
        initializeModelList({ apiKeys: parsedApiKeys, providerSettings })
          .then((modelList) => {
            setModelList(modelList);
          })
          .catch((error) => {
            console.error('Error initializing model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      const provider = LLMManager.getInstance(import.meta.env || process.env || {}).getProvider(providerName);

      if (provider && provider.getDynamicModels) {
        setIsModelLoading(providerName);

        try {
          const providerSettings = getProviderSettings();
          const staticModels = provider.staticModels;
          const dynamicModels = await provider.getDynamicModels(
            newApiKeys,
            providerSettings,
            import.meta.env || process.env || {},
          );

          setModelList((preModels) => {
            const filteredOutPreModels = preModels.filter((x) => x.provider !== providerName);
            return [...filteredOutPreModels, ...staticModels, ...dynamicModels];
          });
        } catch (error) {
          console.error('Error loading dynamic models:', error);
        }
        setIsModelLoading(undefined);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex min-h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
        data-workbench-visible={showWorkbench}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex flex-col lg:flex-row w-full h-full overflow-hidden">
          <div
            className={classNames(
              styles.Chat,
              'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full overflow-auto',
              {
                'lg:max-w-[90%] lg:w-[1200px] lg:mx-auto': !showWorkbench,
              },
            )}
          >
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                <h1 className="text-3xl lg:text-6xl font-bold text-accent-500 mb-4 animate-fade-in">
                  Build with Val-X
                </h1>
                <p className="text-md lg:text-xl mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200">
                  Create, collaborate and build amazing things with Our AI assistance.
                </p>
              </div>
            )}
            <div
              className={classNames('flex-1 pt-6 px-2 sm:px-6 overflow-auto', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="bg-bolt-elements-background-depth-2">
                  {actionAlert && (
                    <ChatAlert
                      alert={actionAlert}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                <div
                  className={classNames(
                    'bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',

                    /*
                     * {
                     *   'sticky bottom-2': chatStarted,
                     * },
                     */
                  )}
                >
                  <svg className={classNames(styles.PromptEffectContainer)}>
                    <defs>
                      <linearGradient
                        id="line-gradient"
                        x1="20%"
                        y1="0%"
                        x2="-14%"
                        y2="10%"
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="rotate(-45)"
                      >
                        <stop offset="0%" stopColor="#E879F9" stopOpacity="0%"></stop>
                        <stop offset="30%" stopColor="#E879F9" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#E879F9" stopOpacity="80%"></stop>
                        <stop offset="70%" stopColor="#E879F9" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#E879F9" stopOpacity="0%"></stop>
                      </linearGradient>
                      <linearGradient id="shine-gradient">
                        <stop offset="0%" stopColor="#22D3EE" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#22D3EE" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#22D3EE" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#22D3EE" stopOpacity="0%"></stop>
                      </linearGradient>
                    </defs>
                    <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
                    <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
                  </svg>
                  <div>
                    <ClientOnly>
                      {() => (
                        <ModelSettingsDialog
                          open={isModelSettingsOpen}
                          onClose={() => setIsModelSettingsOpen(false)}
                          model={model}
                          setModel={setModel}
                          provider={provider}
                          setProvider={setProvider}
                          providerList={providerList}
                          apiKeys={apiKeys}
                          modelList={modelList}
                          onApiKeysChange={onApiKeysChange}
                          isModelLoading={isModelLoading}
                        />
                      )}
                    </ClientOnly>
                  </div>
                  <FilePreview
                    files={uploadedFiles}
                    imageDataList={imageDataList}
                    onRemove={(index) => {
                      setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                      setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                    }}
                  />
                  <ClientOnly>
                    {() => (
                      <ScreenshotStateManager
                        setUploadedFiles={setUploadedFiles}
                        setImageDataList={setImageDataList}
                        uploadedFiles={uploadedFiles}
                        imageDataList={imageDataList}
                      />
                    )}
                  </ClientOnly>
                  <div
                    className={classNames(
                      'relative shadow-xs border border-bolt-elements-borderColor backdrop-blur rounded-lg',
                    )}
                  >
                    <textarea
                      ref={textareaRef}
                      className={classNames(
                        'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
                        'transition-all duration-200',
                        'hover:border-bolt-elements-focus',
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';

                        const files = Array.from(e.dataTransfer.files);
                        files.forEach((file) => {
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();

                            reader.onload = (e) => {
                              const base64Image = e.target?.result as string;
                              setUploadedFiles?.([...uploadedFiles, file]);
                              setImageDataList?.([...imageDataList, base64Image]);
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          // ignore if using input method engine
                          if (event.nativeEvent.isComposing) {
                            return;
                          }

                          handleSendMessage?.(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      onPaste={handlePaste}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="How can Val-X help you today?"
                      translate="no"
                    />
                    <ClientOnly>
                      {() => (
                        <SendButton
                          show={input.length > 0 || isStreaming || uploadedFiles.length > 0}
                          isStreaming={isStreaming}
                          disabled={!providerList || providerList.length === 0}
                          onClick={(event) => {
                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            if (input.length > 0 || uploadedFiles.length > 0) {
                              handleSendMessage?.(event);
                            }
                          }}
                        />
                      )}
                    </ClientOnly>
                    <div className="flex justify-between items-center text-sm p-4 pt-2">
                      <div className="flex gap-1 items-center">
                        <IconButton title="Upload file" className="transition-all" onClick={() => handleFileUpload()}>
                          <div className="i-ph:paperclip text-xl"></div>
                        </IconButton>
                        <IconButton
                          title="Enhance prompt"
                          disabled={input.length === 0 || enhancingPrompt}
                          className={classNames('transition-all', enhancingPrompt ? 'opacity-100' : '')}
                          onClick={() => {
                            enhancePrompt?.();
                            toast.success('Prompt enhanced!');
                          }}
                        >
                          {enhancingPrompt ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                          ) : (
                            <div className="i-bolt:stars text-xl"></div>
                          )}
                        </IconButton>

                        <SpeechRecognitionButton
                          isListening={isListening}
                          onStart={startListening}
                          onStop={stopListening}
                          disabled={isStreaming}
                        />
                        {chatStarted && <ClientOnly>{() => <ExportChatButton exportChat={exportChat} />}</ClientOnly>}
                        <IconButton
                          title="Model Settings"
                          className={classNames('transition-all flex items-center gap-1', {
                            'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                              isModelSettingsOpen,
                            'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                              !isModelSettingsOpen,
                          })}
                          onClick={() => setIsModelSettingsOpen(!isModelSettingsOpen)}
                          disabled={!providerList || providerList.length === 0}
                        >
                          {<span className="text-xs">{model}</span>}
                          <div className={`i-ph:caret-${isModelSettingsOpen ? 'right' : 'down'} text-lg`} />
                        </IconButton>
                      </div>
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">
                          Use <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd>{' '}
                          + <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd>{' '}
                          a new line
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-5">
              {!chatStarted && (
                <div className="flex justify-center gap-2">
                  {ImportButtons(importChat)}
                  <GitCloneButton importChat={importChat} />
                </div>
              )}
              {!chatStarted &&
                ExamplePrompts((event, messageInput) => {
                  if (isStreaming) {
                    handleStop?.();
                    return;
                  }

                  handleSendMessage?.(event, messageInput);
                })}
              {!chatStarted && (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-sm text-gray-500">or start a blank app with your favorite stack</span>
                  <Link
                    to="/templates"
                    className="text-accent-500 hover:text-accent-600 transition-colors flex items-center gap-2"
                  >
                    <div className="i-ph:stack text-lg" />
                    Browse Templates
                  </Link>
                </div>
              )}
            </div>
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
