#!/usr/bin/env node

/**
 * Performance optimization script for React components
 * This script provides guidance and fixes for common React performance issues
 */

const fs = require('fs');
const path = require('path');

// Look for common performance issues
const PERF_ISSUES = {
  // Hook dependencies
  'missingDependencies': /useEffect\(\s*\(\)\s*=>\s*{[\s\S]*?}\s*,\s*\[\s*\]\s*\)/g,
  'functionRecreation': /const\s+(\w+)\s*=\s*(?:\(\w*\)|function\s*\(\w*\))\s*=>\s*{[\s\S]*?};.*\n.*useEffect/g,
  
  // Large render functions
  'largeComponents': /function\s+\w+\([^)]*\)\s*{[\s\S]{3000,}?return/g,
  
  // Expensive rerenders
  'mapInRender': /return\s*\(\s*<[^>]*>\s*{[^}]*\.map\(/g,
  
  // Missing memoization
  'missingMemo': /const\s+(\w+)\s*=\s*(?:\([^)]*\)|function\s*\([^)]*\))\s*=>\s*{[\s\S]*?return\s*\(\s*<[^>]*>/g,
};

// Directory to search for React components
const componentsDir = path.join(__dirname, '..', 'src', 'components');
const contextsDir = path.join(__dirname, '..', 'src', 'contexts');

console.log('🔍 Scanning for React performance issues...\n');

// Count of issues found
let issueCount = 0;

// Process a file to find performance issues
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  let fileIssues = 0;
  
  // Check for each type of issue
  for (const [issueType, pattern] of Object.entries(PERF_ISSUES)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      if (fileIssues === 0) {
        console.log(`\n📄 File: ${fileName}`);
      }
      
      console.log(`  ⚠️ Found ${matches.length} potential ${issueType} issues`);
      fileIssues += matches.length;
      issueCount += matches.length;
    }
  }
  
  // Check for large component file size
  if (content.length > 10000) {
    if (fileIssues === 0) {
      console.log(`\n📄 File: ${fileName}`);
    }
    console.log(`  ⚠️ Large file size (${(content.length / 1024).toFixed(1)}KB) - consider splitting into smaller components`);
    fileIssues++;
    issueCount++;
  }
  
  return fileIssues;
}

// Process all component files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let dirIssues = 0;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      dirIssues += processDirectory(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      dirIssues += processFile(filePath);
    }
  }
  
  return dirIssues;
}

// Process components directory
const componentIssues = processDirectory(componentsDir);
console.log(`\n🧩 Components directory: ${componentIssues} potential issues found`);

// Process contexts directory
const contextIssues = processDirectory(contextsDir);
console.log(`\n🔄 Contexts directory: ${contextIssues} potential issues found`);

console.log('\n📊 Performance Optimization Summary:');
console.log(`Total issues found: ${issueCount}`);

// Provide recommendations
console.log('\n🚀 Recommended Performance Optimizations:');
console.log('1. 🔄 Add missing dependencies to useEffect and useCallback hooks');
console.log('2. 🧠 Use useMemo for expensive calculations');
console.log('3. 🔍 Memoize child components with React.memo()');
console.log('4. 🧩 Split large components into smaller ones');
console.log('5. 📦 Move expensive operations outside render functions');
console.log('6. 💾 Use useCallback for functions passed to child components');

console.log('\nSee the React DevTools Profiler for more detailed performance information.'); 