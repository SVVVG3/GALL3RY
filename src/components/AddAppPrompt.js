import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';

/**
 * Simple component that focuses solely on prompting the user to add the app
 * using the most direct approach possible
 */
const AddAppPrompt = () => {
  const [promptState, setPromptState] = useState('idle'); // idle, ready, attempting, success, failed

  useEffect(() => {
    // Check if SDK is available
    if (!sdk || !sdk.actions) {
      console.error('SDK or actions not available');
      setPromptState('failed');
      return;
    }

    // First make sure splash screen is dismissed
    const dismissSplashScreen = async () => {
      try {
        if (typeof sdk.actions.ready === 'function') {
          console.log('Calling sdk.actions.ready() to dismiss splash screen');
          await sdk.actions.ready();
          console.log('Splash screen dismissed successfully');
          setPromptState('ready');
          
          // Now that splash screen is dismissed, prompt to add after a short delay
          setTimeout(() => {
            promptAddApp();
          }, 1500);
        } else {
          console.error('ready method not available');
          setPromptState('failed');
        }
      } catch (error) {
        console.error('Error dismissing splash screen:', error);
        setPromptState('failed');
      }
    };

    // Simple function to prompt user to add the app
    const promptAddApp = async () => {
      if (typeof sdk.actions.addFrame !== 'function') {
        console.error('addFrame method not available');
        setPromptState('failed');
        return;
      }
      
      try {
        setPromptState('attempting');
        console.log('Directly calling sdk.actions.addFrame()');
        
        // Directly call addFrame as shown in the documentation
        await sdk.actions.addFrame();
        
        console.log('addFrame call completed successfully');
        setPromptState('success');
      } catch (error) {
        console.error('Error calling addFrame:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setPromptState('failed');
      }
    };

    // Start the process after a short delay
    const timeoutId = setTimeout(() => {
      dismissSplashScreen();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Add a small button that can be clicked to manually trigger the prompt
  const manualPrompt = async () => {
    try {
      console.log('Manually calling sdk.actions.addFrame()');
      if (sdk && sdk.actions && typeof sdk.actions.addFrame === 'function') {
        await sdk.actions.addFrame();
        console.log('Manual addFrame call completed');
      } else {
        console.error('SDK or addFrame not available for manual call');
      }
    } catch (error) {
      console.error('Error in manual addFrame call:', error);
    }
  };

  // Render nothing visible to the user, but keep the component mounted to handle the logic
  return (
    <div style={{ display: 'none' }}>
      <div data-testid="prompt-state">{promptState}</div>
      <button 
        onClick={manualPrompt}
        id="manual-add-app-trigger"
      >
        Add App (Manual Trigger)
      </button>
    </div>
  );
};

export default AddAppPrompt; 