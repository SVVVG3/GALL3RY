const fs = require('fs');
const path = require('path');

console.log('Starting clean-build process...');

// Define the build directory
const buildDir = path.join(__dirname, 'build');

// Function to replace %PUBLIC_URL% with empty string in HTML files
function processHtmlFiles(directory) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      processHtmlFiles(filePath);
    } else if (file.endsWith('.html')) {
      console.log(`Processing HTML file: ${filePath}`);
      
      // Read the file content
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace %PUBLIC_URL% with empty string
      const updatedContent = content.replace(/%PUBLIC_URL%/g, '');
      
      // Write the updated content back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      
      console.log(`Replaced %PUBLIC_URL% in ${file}`);
    }
  });
}

// Check if build directory exists
if (fs.existsSync(buildDir)) {
  console.log(`Found build directory: ${buildDir}`);
  processHtmlFiles(buildDir);
  console.log('Clean-build process completed successfully!');
} else {
  console.error(`Build directory not found: ${buildDir}`);
  process.exit(1);
} 