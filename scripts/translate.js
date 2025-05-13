/**
 *
 * (c) Copyright Mustafa Berkan Bicer 2025
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function(window, undefined){
    var isInit = false;
    var currentText = '';
    var currentAction = 'translate';
    var settings = {
        apiUrl: 'http://localhost:11434',
        model: 'llama2:latest',
        temperature: 0.7
    };

    // Load settings from localStorage
    function loadSettings() {
        const savedSettings = localStorage.getItem('ollamaSettings');
        if (savedSettings) {
            settings = { ...settings, ...JSON.parse(savedSettings) };
        }
        
        // Update UI with loaded settings
        document.getElementById('apiUrl').value = settings.apiUrl;
        document.getElementById('temperature').value = settings.temperature;
        document.querySelector('.slider-value').textContent = settings.temperature;
        
        // Set model if it exists in the list
        const modelSelect = document.getElementById('modelSelect');
        if (settings.model && modelSelect) {
            const option = new Option(settings.model, settings.model);
            modelSelect.options.add(option);
            modelSelect.value = settings.model;
        }
    }

    // Save settings to localStorage
    function saveSettings() {
        localStorage.setItem('ollamaSettings', JSON.stringify(settings));
    }

    // Initialize settings handlers
    function initializeSettings() {
        const apiUrlInput = document.getElementById('apiUrl');
        const temperatureSlider = document.getElementById('temperature');
        const modelSelect = document.getElementById('modelSelect');

        apiUrlInput.addEventListener('change', function() {
            settings.apiUrl = this.value;
            saveSettings();
            loadOllamaModels(); // Reload models when API URL changes
        });

        temperatureSlider.addEventListener('input', function() {
            settings.temperature = parseFloat(this.value);
            document.querySelector('.slider-value').textContent = this.value;
            saveSettings();
        });

        if (modelSelect) {
            modelSelect.addEventListener('change', function() {
                settings.model = this.value;
                saveSettings();
            });
        }
    }

    // Tab handling
    function initializeTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                
                // Remove active class from all tabs and contents
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    async function loadOllamaModels() {
        try {
            const response = await fetch(`${settings.apiUrl}/api/tags`);
            if (!response.ok) {
                throw new Error('Failed to fetch models');
            }
            const data = await response.json();
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = ''; // Clear existing options
            
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });

            // Select current model if it exists in the list
            if (settings.model) {
                modelSelect.value = settings.model;
            }
        } catch (error) {
            console.error('Failed to load Ollama models:', error);
            // Add a default option
            const option = document.createElement('option');
            option.value = 'llama2:latest';
            option.textContent = 'llama2:latest';
            document.getElementById('modelSelect').appendChild(option);
        }
    }

    async function checkOllamaAvailability() {
        try {
            const response = await fetch(`${settings.apiUrl}/api/tags`);
            if (!response.ok) {
                throw new Error('Ollama service is not responding properly');
            }
            console.log('Ollama service is available');
            return true;
        } catch (error) {
            console.error('Ollama service check failed:', error);
            throw new Error('Cannot connect to Ollama. Please ensure the service is running at ' + settings.apiUrl);
        }
    }

    async function processWithOllama(text, action, options = {}) {
        try {
            console.log('Processing request for action:', action);
            
            await checkOllamaAvailability();

            let prompt;
            switch(action) {
                case 'generate':
                    prompt = `Generate text based on this prompt: "${text}"`;
                    break;
                case 'paraphrase':
                    prompt = `Paraphrase the following text while maintaining its meaning: "${text}"`;
                    break;
                case 'summarize':
                    prompt = `Provide a concise summary of the following text: "${text}"`;
                    break;
                case 'translate':
                    prompt = `Translate the following text to ${options.targetLang}. Only return the translation: "${text}"`;
                    break;
                case 'improve':
                    prompt = `Improve the writing style of the following text while maintaining its meaning: "${text}"`;
                    break;
                case 'extend':
                    prompt = `Extend and elaborate on the following text while maintaining its style and tone: "${text}"`;
                    break;
                case 'custom':
                    prompt = `${options.customPrompt} "${text}"`;
                    break;
                default:
                    throw new Error('Unknown action requested');
            }

            const response = await fetch(`${settings.apiUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: settings.model,
                    prompt: prompt,
                    stream: false, // Changed to false to get a single response
                    temperature: settings.temperature
                })
            });

            if (!response.ok) {
                throw new Error(`Processing failed: ${response.status} ${response.statusText}`);
            }

            // Parse the JSON response
            const data = await response.json();
            return data.response ? data.response.trim() : '';
        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        }
    }

    function cleanupEventListeners() {
        // Remove existing event listeners
        const actionButtons = document.querySelectorAll('.action-button');
        actionButtons.forEach(button => {
            button.replaceWith(button.cloneNode(true));
        });

        const translateButton = document.getElementById('translateButton');
        if (translateButton) {
            translateButton.replaceWith(translateButton.cloneNode(true));
        }
    }

    function showPromptInput() {
        const promptArea = document.getElementById('promptArea');
        if (promptArea) {
            promptArea.style.display = 'block';
        }
    }

    function hidePromptInput() {
        const promptArea = document.getElementById('promptArea');
        if (promptArea) {
            promptArea.style.display = 'none';
        }
    }

    function initializeUI() {
        if (isInit) {
            console.log('UI already initialized, cleaning up first');
            cleanupEventListeners();
        }

        console.log('Initializing UI...');
        
        // Initialize tabs
        initializeTabs();
        
        // Initialize settings
        initializeSettings();
        
        // Load saved settings
        loadSettings();
        
        // Load Ollama models
        loadOllamaModels();

        // Initialize language select
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            // Ensure there's at least a default option
            if (languageSelect.options.length === 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = 'en';
                defaultOption.textContent = 'English';
                languageSelect.appendChild(defaultOption);
            }
            console.log('Language select initialized with', languageSelect.options.length, 'options');
        } else {
            console.error('Language select element not found');
        }

        // Initialize action buttons
        const actionButtons = document.querySelectorAll('.action-button');
        console.log('Found action buttons:', actionButtons.length);
        
        actionButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                console.log('Action button clicked:', this.dataset.action);
                e.stopPropagation(); // Prevent event bubbling
                
                // Remove active class from all buttons
                actionButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                currentAction = this.dataset.action;
                const languageDropdown = document.getElementById('languageSelect');
                const promptArea = document.getElementById('promptArea');
                const translationArea = document.getElementById('translationArea');
                
                // Show/hide language dropdown and prompt input based on action
                if (languageDropdown) {
                    languageDropdown.classList.toggle('visible', currentAction === 'translate');
                }
                
                if (currentAction === 'custom') {
                    showPromptInput();
                } else {
                    hidePromptInput();
                }

                // Set translation area height based on action
                if (translationArea) {
                    translationArea.classList.remove('height-220', 'height-290');
                    if (currentAction === 'translate' || currentAction === 'custom') {
                        translationArea.classList.add('height-220');
                    } else {
                        translationArea.classList.add('height-290');
                    }
                }
                
                // Update button text based on action
                const translateButton = document.getElementById('translateButton');
                if (translateButton) {
                    translateButton.textContent = currentAction === 'translate' ? 'Translate' : 'Process';
                }
            });
        });

        // Set up process button handler
        const translateButton = document.getElementById('translateButton');
        console.log('Found translate button:', translateButton);
        
        if (translateButton) {
            // Event handler function
            const processHandler = async function(e) {
                e.preventDefault(); // Prevent form submission if any
                e.stopPropagation(); // Prevent event bubbling
                console.log('Process button clicked - handler executing');
                
                if (this.dataset.processing === 'true') {
                    console.log('Already processing, ignoring click');
                    return;
                }

                const translationArea = document.getElementById('translationArea');
                const promptInput = document.getElementById('promptInput');
                const languageSelect = document.getElementById('languageSelect');
                
                // Validate language selection for translate action
                if (currentAction === 'translate' && (!languageSelect || !languageSelect.value)) {
                    alert('Please select a target language');
                    return;
                }

                const options = {
                    targetLang: languageSelect ? languageSelect.value : '',
                    customPrompt: promptInput ? promptInput.value : ''
                };

                if (!currentText.trim()) {
                    alert('Please select text to process');
                    return;
                }

                if (currentAction === 'custom' && !options.customPrompt.trim()) {
                    alert('Please enter a prompt');
                    return;
                }

                try {
                    this.disabled = true;
                    this.dataset.processing = 'true';
                    this.textContent = 'Processing...';
                    
                    const processedText = await processWithOllama(currentText, currentAction, options);
                    if (translationArea) {
                        translationArea.textContent = processedText;
                    }
                    
                    // Update document with processed text if needed
                    if (window.Asc.plugin.info.editorType === 'word') {
                        window.Asc.plugin.executeMethod('PasteHtml', [processedText]);
                    }
                } catch (error) {
                    console.error('Processing failed:', error);
                    alert('Processing failed: ' + error.message);
                } finally {
                    this.disabled = false;
                    delete this.dataset.processing;
                    this.textContent = currentAction === 'translate' ? 'Translate' : 'Process';
                }
            };

            // Remove old click listener and add new one properly
            translateButton.removeEventListener('click', processHandler);
            translateButton.addEventListener('click', processHandler);
        }

        // Set translate as default action
        const defaultButton = document.querySelector('[data-action="translate"]');
        if (defaultButton) {
            defaultButton.click();
        }

        isInit = true;
    }
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme === 'theme-dark' ? 'dark' : 'light');
    }

    window.Asc.plugin.init = function(text) {
        console.log('Plugin initialization started');
        
        currentText = window.Asc.plugin.info.editorType === 'word' ? text : text.replace(/\t/g, '\n');
        
        // Initialize UI only once when document is ready
        if (!isInit) {
            if (document.readyState === 'complete') {
                console.log('Document ready, initializing UI');
                initializeUI();
                // Set initial theme
                setTheme(window.Asc.plugin.theme);
            } else {
                console.log('Document not ready, waiting for DOMContentLoaded');
                document.addEventListener('DOMContentLoaded', function() {
                    if (!isInit) {
                        initializeUI();
                        // Set initial theme
                        setTheme(window.Asc.plugin.theme);
                    }
                });
            }
            isInit = true;
        }
        
        // Display the text in translation area
        const translationArea = document.getElementById('translationArea');
        if (translationArea) {
            translationArea.textContent = currentText;
        }
    };

    window.Asc.plugin.button = function(id) {
        this.executeCommand("close", "");
    };

    window.Asc.plugin.onThemeChanged = function(theme) {
        window.Asc.plugin.onThemeChangedBase(theme);
        setTheme(theme);
    };

})(window, undefined);
