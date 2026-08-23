/**
 * Design Token to CSS Variables Converter
 * 
 * This script reads a design tokens JSON file (e.g., Figma Tokens format)
 * and converts it into a CSS file containing CSS custom properties (variables).
 * 
 * Key Features:
 * 1. Flattens nested JSON structures into CSS variable names.
 *    Example: "primitive colors" -> "key colors" -> "primary key color"
 *    Becomes: --primitive-colors-key-colors-primary-key-color
 * 2. Resolves aliases.
 *    Example: "{primitive colors.key colors.primary key color}"
 *    Becomes: var(--primitive-colors-key-colors-primary-key-color)
 * 3. Handles custom token types (like drop shadows).
 * 4. Generates a tokens.css file.
 * 
 * Color System Note:
 * The design system has two layers of colors:
 * - Primitive Colors: The foundational palette (e.g., hex codes). These are generated
 *   as CSS variables but should NOT be used directly on UI components.
 * - Color Roles: The semantic colors (e.g., primary, on-primary). These reference 
 *   the primitive colors using CSS variables. Use these directly on the UI.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, 'design-tokens.tokens.json');
const OUTPUT_FILE = path.join(__dirname, 'tokens.css');

// Helper to format path array into a CSS variable name
// e.g. ['color roles', 'primary color roles', 'primary'] -> '--color-roles-primary-color-roles-primary'
function formatVariableName(pathArray) {
    return '--' + pathArray
        .map(part => part.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, ''))
        .join('-');
}

// Helper to resolve an alias string to a CSS variable reference
// e.g. "{primitive colors.key colors.primary key color}" -> "var(--primitive-colors-key-colors-primary-key-color)"
function resolveAlias(value) {
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        // Extract the path inside the curly braces
        const aliasPath = value.slice(1, -1);
        // Split by dot and format to CSS variable name
        const pathArray = aliasPath.split('.');
        const cssVar = formatVariableName(pathArray);
        return `var(${cssVar})`;
    }
    return value;
}

// Helper to format complex values (like shadows) into CSS values
function formatComplexValue(type, value) {
    if (type === 'custom-shadow') {
        // Handle drop shadows (offset-x, offset-y, blur-radius, spread-radius, color)
        // Figma tokens might provide an object
        if (typeof value === 'object') {
            const { offsetX, offsetY, radius, spread, color } = value;
            return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${color}`;
        }
    }
    
    // For typography or other complex objects, additional logic could be added here
    // Default to stringifying if it's an object we don't explicitly handle
    if (typeof value === 'object') {
        console.warn(`Unrecognized complex value for type: ${type}`, value);
        return null;
    }
    
    return value;
}

/**
 * Recursively traverses the design tokens object and flattens them.
 * 
 * @param {Object} obj - The current level of the token object
 * @param {Array<string>} currentPath - The path array representing the current nesting
 * @param {Array<Object>} tokens - An array accumulating the flattened tokens
 */
function extractTokens(obj, currentPath = [], tokens = []) {
    for (const [key, node] of Object.entries(obj)) {
        // If the node has a "value" property, it's a token
        if (node !== null && typeof node === 'object' && node.hasOwnProperty('value')) {
            const tokenPath = [...currentPath, key];
            
            // Format the final value
            let finalValue;
            if (typeof node.value === 'string') {
                finalValue = resolveAlias(node.value);
            } else {
                finalValue = formatComplexValue(node.type, node.value);
            }

            // Convert typography numerical measurements to rem
            const keyLower = key.toLowerCase();
            if (['fontsize', 'lineheight', 'letterspacing'].includes(keyLower)) {
                const numValue = parseFloat(finalValue);
                if (!isNaN(numValue) && finalValue !== 0) {
                    finalValue = `${numValue / 16}rem`;
                } else if (finalValue === 0 || finalValue === '0') {
                    finalValue = '0rem';
                }
            }

            if (finalValue !== null) {
                tokens.push({
                    name: formatVariableName(tokenPath),
                    value: finalValue,
                    description: node.description || '',
                    originalPath: tokenPath
                });
            }
        } else if (node !== null && typeof node === 'object') {
            // It's a token group, traverse deeper
            extractTokens(node, [...currentPath, key], tokens);
        }
    }
    return tokens;
}

function generateCSS() {
    try {
        console.log(`Reading design tokens from: ${INPUT_FILE}`);
        const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
        const tokenData = JSON.parse(rawData);

        console.log('Parsing tokens...');
        const tokens = extractTokens(tokenData);

        console.log(`Generating CSS with ${tokens.length} variables...`);
        let cssContent = `/* 
 * Design System Tokens 
 * Auto-generated from design-tokens.tokens.json 
 * 
 * IMPORTANT NOTE ON COLORS:
 * - DO NOT use variables starting with --primitive-colors directly on the UI. They are foundational.
 * - INSTEAD, use variables starting with --color-roles which map to the semantic design system.
 */\n\n:root {\n`;

        // We can group tokens by their top-level category for better readability
        const categories = {};
        tokens.forEach(token => {
            const topLevel = token.originalPath[0];
            if (!categories[topLevel]) categories[topLevel] = [];
            categories[topLevel].push(token);
        });

        for (const [category, categoryTokens] of Object.entries(categories)) {
            cssContent += `\n  /* === ${category.toUpperCase()} === */\n`;
            categoryTokens.forEach(token => {
                if (token.description) {
                    cssContent += `  /* ${token.description} */\n`;
                }
                cssContent += `  ${token.name}: ${token.value};\n`;
            });
        }

        cssContent += `}\n`;

        // Append dark mode variables
        cssContent += `
@media (prefers-color-scheme: dark) {
  :root {
    --color-roles-primary-color-roles-primary: var(--primitive-colors-primary-color-palette-primary80);
    --color-roles-primary-color-roles-on-primary: var(--primitive-colors-primary-color-palette-primary20);
    --color-roles-primary-color-roles-primary-container: var(--primitive-colors-primary-color-palette-primary30);
    --color-roles-primary-color-roles-on-primary-container: var(--primitive-colors-primary-color-palette-primary90);
    --color-roles-secondary-color-roles-secondary: var(--primitive-colors-secondary-color-palette-secondary80);
    --color-roles-secondary-color-roles-on-secondary: var(--primitive-colors-secondary-color-palette-secondary20);
    --color-roles-secondary-color-roles-secondary-container: var(--primitive-colors-secondary-color-palette-secondary30);
    --color-roles-secondary-color-roles-on-secondary-container: var(--primitive-colors-secondary-color-palette-secondary90);
    --color-roles-tertiary-color-roles-tertiary: var(--primitive-colors-tertiary-color-palette-tertiary80);
    --color-roles-tertiary-color-roles-on-tertiary: var(--primitive-colors-tertiary-color-palette-tertiary20);
    --color-roles-tertiary-color-roles-tertiary-container: var(--primitive-colors-tertiary-color-palette-tertiary30);
    --color-roles-tertiary-color-roles-on-tertiary-container: var(--primitive-colors-tertiary-color-palette-tertiary90);
    --color-roles-surface-color-roles-surfcace: var(--primitive-colors-neutral-color-palette-neutral10);
    --color-roles-surface-color-roles-on-surface: var(--primitive-colors-neutral-color-palette-neutral90);
    --color-roles-surface-color-roles-surface-variant: var(--primitive-colors-neutralvariant-color-palette-neutralvariant30);
    --color-roles-surface-color-roles-on-surface-variant: var(--primitive-colors-neutralvariant-color-palette-neutralvariant90);
    --color-roles-surface-color-roles-surface-container-highest: var(--primitive-colors-neutral-color-palette-neutral40);
    --color-roles-surface-color-roles-surface-container-high: var(--primitive-colors-neutral-color-palette-neutral30);
    --color-roles-surface-color-roles-surface-container: var(--primitive-colors-neutral-color-palette-neutral20);
    --color-roles-surface-color-roles-surface-conatiner-low: var(--primitive-colors-neutral-color-palette-neutral10);
    --color-roles-surface-color-roles-surface-container-lowest: var(--primitive-colors-neutral-color-palette-neutral0);
    --color-roles-surface-color-roles-inverse-surface: var(--primitive-colors-neutral-color-palette-neutral90);
    --color-roles-surface-color-roles-inverse-on-surface: var(--primitive-colors-neutral-color-palette-neutral20);
    --color-roles-surface-color-roles-surface-tint: var(--primitive-colors-primary-color-palette-primary80);
    --color-roles-error-color-roles-error: var(--primitive-colors-error-color-pallete-error80);
    --color-roles-error-color-roles-on-error: var(--primitive-colors-error-color-pallete-error20);
    --color-roles-error-color-roles-error-container: var(--primitive-colors-error-color-pallete-error30);
    --color-roles-error-color-roles-on-error-container: var(--primitive-colors-error-color-pallete-error90);
    --color-roles-outline-color-roles-outline: var(--primitive-colors-neutralvariant-color-palette-neutralvariant60);
    --color-roles-outline-color-roles-outline-variant: var(--primitive-colors-neutralvariant-color-palette-neutralvariant30);
  }
}
`;

        fs.writeFileSync(OUTPUT_FILE, cssContent, 'utf8');
        console.log(`Successfully generated CSS at: ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('Error processing design tokens:', error);
    }
}

// Execute the generation
generateCSS();
