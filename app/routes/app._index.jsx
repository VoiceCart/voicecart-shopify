import { useFetcher } from "@remix-run/react";
import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Page,
  Text,
  ButtonGroup,
  Select,
  Frame,
  Toast
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { fetchWithToken } from "../utils/fetchWithToken.client";

export default function DownloadProducts() {
  const fetcher = useFetcher();
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState("");
  const [currentTaskType, setCurrentTaskType] = useState(null);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [toast, setToast] = useState({ active: false, content: "" });
  
  // Progress tracking states
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const showToast = useCallback(
    (content) => setToast({ active: true, content }),
    []
  );
  const handleToastDismiss = useCallback(
    () => setToast({ ...toast, active: false }),
    [toast]
  );

  const isLoading = fetcher.state === "loading" || fetcher.state === "submitting";

  // Progress messages for different tasks
  const getProgressMessages = (taskType) => {
    const messages = {
      'product-catalog': [
        'Connecting to product database...',
        'Fetching product information...',
        'Processing product data...',
        'Generating catalog structure...',
        'Saving catalog to server...',
        'Product catalog generated successfully!'
      ],
      'create-embeddings': [
        'Initializing AI model...',
        'Processing product descriptions...',
        'Generating embeddings...',
        'Optimizing search vectors...',
        'Storing embeddings...',
        'Product embeddings created successfully!'
      ],
      'delete-embeddings': [
        'Connecting to server...',
        'Locating embedding files...',
        'Removing embeddings...',
        'Cleaning up references...',
        'Embeddings deleted successfully!'
      ],
      'create-prompt': [
        'Analyzing product catalog...',
        'Generating system prompt...',
        'Optimizing for voice interaction...',
        'Saving prompt configuration...',
        'System prompt created successfully!'
      ]
    };
    return messages[taskType] || ['Processing...'];
  };

  // Simulate progress for visual feedback
  const simulateProgress = useCallback((taskType) => {
    setShowProgress(true);
    setProgress(0);
    
    const messages = getProgressMessages(taskType);
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5;
      if (currentProgress > 95) currentProgress = 95; // Don't complete until real task finishes
      
      setProgress(currentProgress);
      const messageIndex = Math.min(Math.floor(currentProgress / 20), messages.length - 2);
      setProgressText(messages[messageIndex]);
    }, 500);
    
    return interval;
  }, []);

  const completeProgress = useCallback((taskType) => {
    const messages = getProgressMessages(taskType);
    setProgress(100);
    setProgressText(messages[messages.length - 1]);
    
    setTimeout(() => {
      setShowProgress(false);
      setProgress(0);
      setProgressText("");
    }, 2000);
  }, []);

  const startTask = (taskType) => {
    fetcher.submit({ taskType }, { method: "POST", action: "/api/start-task" });
  };

  const downloadProducts = () => startTask("product-catalog");
  const createEmbeddings = () => startTask("create-embeddings");
  const deleteEmbeddings = () => startTask("delete-embeddings");

  const fetchStoreInfoAndTags = async () => {
    const progressInterval = simulateProgress('create-prompt');
    
    try {
      const response = await fetchWithToken("/api/generate-prompt", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        console.log("Shop Description:", data.shopDescription);
        console.log("Unique Tags:", data.uniqueTags);
        showToast("Store info and tags printed to console. Fetching prompt...");
        await fetchPromptFromDB();
        clearInterval(progressInterval);
        completeProgress('create-prompt');
      } else {
        console.error("Error response from server:", data);
        showToast(`Error: ${data.error || "Failed to fetch store info"}`);
        clearInterval(progressInterval);
        setShowProgress(false);
      }
    } catch (error) {
      console.error("Network error fetching store info:", error);
      showToast("Error processing store info");
      clearInterval(progressInterval);
      setShowProgress(false);
    }
  };

  const fetchPromptFromDB = async () => {
    try {
      const response = await fetchWithToken("/api/get-saved-prompt", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok && data.generalPrompt) {
        console.log("Generated Store Prompt (from DB):", data.generalPrompt);
        showToast("Prompt successfully retrieved from database and printed");
      } else {
        console.error("No prompt found in DB or error:", data);
        showToast(`Error: ${data.error || "Prompt not found in DB"}`);
      }
    } catch (error) {
      console.error("Network error fetching prompt from DB:", error);
      showToast("Error fetching prompt from database");
    }
  };

  const setGlobalLanguage = () => {
    fetcher.submit(
      { language: defaultLanguage },
      { method: "POST", action: "/api/set-global-language" }
    );
  };

  useEffect(() => {
    if (fetcher.data?.taskId) {
      const { taskId, taskType } = fetcher.data;
      setTaskId(taskId);
      setCurrentTaskType(taskType);
      setStatus("In Progress");
      localStorage.setItem("taskId", taskId);
      localStorage.setItem("taskType", taskType);
      showToast(
        `${taskType === "product-catalog" ? "Download" : "Embedding"} started...`
      );
      
      // Start progress simulation
      simulateProgress(taskType);
    } else if (fetcher.data?.error) {
      setStatus("Failed");
      showToast(fetcher.data.error);
      setShowProgress(false);
    } else if (fetcher.data?.success) {
      showToast(`Global language set to ${defaultLanguage}`);
    }
  }, [fetcher.data, showToast, defaultLanguage, simulateProgress]);

  useEffect(() => {
    const savedTaskId = localStorage.getItem("taskId");
    const savedTaskType = localStorage.getItem("taskType");
    if (savedTaskId) {
      setTaskId(savedTaskId);
      setCurrentTaskType(savedTaskType);
      setStatus("In Progress");
    }
  }, []);

  useEffect(() => {
    if (taskId) {
      const interval = setInterval(async () => {
        const response = await fetchWithToken(`/api/status-task?taskId=${taskId}`);
        const data = await response.json();
        if (data.status === "success" || data.status === "failed") {
          const newStatus = data.status === "success" ? "Completed" : "Failed";
          setStatus(newStatus);
          
          if (data.status === "success") {
            // Mark step as completed
            setCompletedSteps(prev => new Set([...prev, currentTaskType]));
            completeProgress(currentTaskType);
          } else {
            setShowProgress(false);
          }
          
          showToast(
            `${currentTaskType === "product-catalog" ? "Download" : "Embedding"} ${data.status}!`
          );
          localStorage.removeItem("taskId");
          localStorage.removeItem("taskType");
          clearInterval(interval);
        } else if (data.error) {
          setStatus("Failed");
          showToast(data.error);
          localStorage.removeItem("taskId");
          localStorage.removeItem("taskType");
          setShowProgress(false);
          clearInterval(interval);
        } else {
          setStatus("In Progress");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [taskId, currentTaskType, showToast, completeProgress]);

  // Check if embeddings can be created (catalog should be generated first)
  const canCreateEmbeddings = completedSteps.has('product-catalog');

  return (
    <Frame>
      <Page title="VoiceCart - Admin panel">
        <TitleBar title="VoiceCart - Admin panel" primaryAction={null} />

        {/* Language Settings */}
        {showLanguageSettings && (
        <Card sectioned>
          <Text variant="headingMd" as="h2">Global Settings</Text>
          <div style={{ marginTop: '16px' }}>
            <Text>Set the default global language for your store.</Text>
            <div style={{ marginTop: '12px', marginBottom: '16px' }}>
              <Select
                label="Global Language"
                options={[
                  { label: "English", value: "en" },
                  { label: "Russian", value: "ru" },
                  { label: "German", value: "de" },
                  { label: "Czech", value: "cs" },
                ]}
                onChange={(value) => setDefaultLanguage(value)}
                value={defaultLanguage}
              />
            </div>
            <Button onClick={setGlobalLanguage} primary disabled={isLoading}>
              Set Global Language
            </Button>
          </div>
        </Card>
        )}

        {/* Progress Bar */}
        {showProgress && (
          <Card sectioned>
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#f1f2f3',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #008060, #00a67c)',
                  borderRadius: '4px',
                  width: `${progress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
            <Text variant="bodyMd" color="subdued" alignment="center">
              {progressText}
            </Text>
          </Card>
        )}

        {/* Setup Steps */}
        <Card sectioned>
          <Text variant="headingMd" as="h2">Setup Steps</Text>
          <Text variant="bodyMd" color="subdued" style={{ marginBottom: '20px' }}>
            Complete these steps in order to set up your VoiceCart
          </Text>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Step 1: Generate Product Catalog */}
            <div style={{
              border: '1px solid #e1e3e5',
              borderRadius: '8px',
              padding: '20px',
              position: 'relative',
              backgroundColor: completedSteps.has('product-catalog') ? '#f6ffed' : 'white'
            }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: completedSteps.has('product-catalog') ? '#008060' : '#1976d2',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {completedSteps.has('product-catalog') ? '✓' : '1'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '24px',
                  marginRight: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '8px'
                }}>
                  📦
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Generate Product Catalog</Text>
                  <Text variant="bodyMd" color="subdued">
                    Create and store your product catalog on the server. This is the first step in setting up your VoiceCart.
                  </Text>
                  {status && currentTaskType === "product-catalog" && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: status === 'Completed' ? '#f0fdf4' : '#fef7e0',
                        color: status === 'Completed' ? '#166534' : '#9c6500'
                      }}>
                        Status: {status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                onClick={downloadProducts}
                primary
                loading={
                  (isLoading && currentTaskType === "product-catalog") ||
                  (status === "In Progress" && currentTaskType === "product-catalog")
                }
                disabled={status === "In Progress" && currentTaskType === "product-catalog"}
              >
                Generate Product Catalog
              </Button>
            </div>

            {/* Step 2: Create Product Embeddings */}
            <div style={{
              border: '1px solid #e1e3e5',
              borderRadius: '8px',
              padding: '20px',
              position: 'relative',
              backgroundColor: completedSteps.has('create-embeddings') ? '#f6ffed' : 'white',
              opacity: canCreateEmbeddings ? 1 : 0.7
            }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: completedSteps.has('create-embeddings') ? '#008060' : '#7b1fa2',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {completedSteps.has('create-embeddings') ? '✓' : '2'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '24px',
                  marginRight: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3e5f5',
                  borderRadius: '8px'
                }}>
                  🧠
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Create Product Embeddings</Text>
                  <Text variant="bodyMd" color="subdued">
                    Generate AI embeddings for your products to enable smart voice search and recommendations.
                  </Text>
                  {status && currentTaskType === "create-embeddings" && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: status === 'Completed' ? '#f0fdf4' : '#fef7e0',
                        color: status === 'Completed' ? '#166534' : '#9c6500'
                      }}>
                        Status: {status}
                      </span>
                    </div>
                  )}
                  {!canCreateEmbeddings && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: '#fef7e0',
                        color: '#9c6500'
                      }}>
                        Complete Step 1 First
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                onClick={createEmbeddings}
                primary
                disabled={!canCreateEmbeddings || (status === "In Progress" && currentTaskType === "create-embeddings")}
                loading={
                  (isLoading && currentTaskType === "create-embeddings") ||
                  (status === "In Progress" && currentTaskType === "create-embeddings")
                }
              >
                Create Product Embeddings
              </Button>
            </div>
          </div>
        </Card>

        {/* Optional Actions */}
        <Card sectioned>
          <Text variant="headingMd" as="h2">Optional Actions</Text>
          <Text variant="bodyMd" color="subdued" style={{ marginBottom: '20px' }}>
            These actions can be performed at any time
          </Text>
          
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {/* Delete Embeddings */}
            <div style={{
              border: '1px solid #e1e3e5',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '24px',
                  marginRight: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffebee',
                  borderRadius: '8px'
                }}>
                  🗑️
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Delete Product Embeddings</Text>
                  <Text variant="bodyMd" color="subdued">
                    Remove product embeddings from the server. Use this to reset or clean up your data.
                  </Text>
                  {status && currentTaskType === "delete-embeddings" && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: status === 'Completed' ? '#f0fdf4' : '#fef7e0',
                        color: status === 'Completed' ? '#166534' : '#9c6500'
                      }}>
                        Status: {status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                onClick={deleteEmbeddings}
                destructive
                loading={
                  (isLoading && currentTaskType === "delete-embeddings") ||
                  (status === "In Progress" && currentTaskType === "delete-embeddings")
                }
                disabled={status === "In Progress" && currentTaskType === "delete-embeddings"}
              >
                Delete Product Embeddings
              </Button>
            </div>

            {/* Create Prompt */}
            <div style={{
              border: '1px solid #e1e3e5',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '24px',
                  marginRight: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#e8f5e8',
                  borderRadius: '8px'
                }}>
                  💡
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Create System Prompt</Text>
                  <Text variant="bodyMd" color="subdued">
                    Generate and save a system prompt with relevant shop assortment for better AI responses.
                  </Text>
                </div>
              </div>
              
              <Button onClick={fetchStoreInfoAndTags} primary>
                Create Prompt
              </Button>
            </div>
          </div>
        </Card>
      </Page>

      {toast.active && (
        <Toast content={toast.content} onDismiss={handleToastDismiss} duration={4000} />
      )}
    </Frame>
  );
}
