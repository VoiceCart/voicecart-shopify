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
        {/* <Card sectioned style="display: none">
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
        </Card> */}

        {/* Progress Bar */}
        {showProgress && (
          <div style={{ marginBottom: '24px' }}>
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
          </div>
        )}

        {/* Setup Steps */}
        <div style={{ marginBottom: '32px' }}>
          <Card>
            <div style={{ padding: '24px' }}>
              <Text variant="headingLg" as="h2" fontWeight="semibold">Setup Steps</Text>
              <Text variant="bodyMd" color="subdued" style={{ marginTop: '8px', marginBottom: '32px' }}>
                Complete these steps in order to set up your VoiceCart
              </Text>
              
              <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))' }}>
                {/* Step 1: Generate Product Catalog */}
                <div style={{
                  border: completedSteps.has('product-catalog') ? '2px solid #00A651' : '1px solid #E1E3E5',
                  borderRadius: '16px',
                  padding: '32px',
                  position: 'relative',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}>
                  {/* Step number badge */}
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: completedSteps.has('product-catalog') ? '#00A651' : '#1976d2',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {completedSteps.has('product-catalog') ? '✓' : '1'}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      backgroundColor: '#E3F2FD',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      📦
                    </div>
                    <div>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Generate Product Catalog</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '4px' }}>
                        Create and store your product catalog on the server. This is the first step in setting up your VoiceCart.
                      </Text>
                      
                      {/* Status badge */}
                      {completedSteps.has('product-catalog') ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#F0FDF4',
                            color: '#166534',
                            border: '1px solid #BBF7D0'
                          }}>
                            ✓ Completed
                          </span>
                        </div>
                      ) : status && currentTaskType === "product-catalog" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: status === 'In Progress' ? '#FEF7E0' : '#FEF2F2',
                            color: status === 'In Progress' ? '#9C6500' : '#DC2626',
                            border: status === 'In Progress' ? '1px solid #FCD34D' : '1px solid #FECACA'
                          }}>
                            {status === 'In Progress' ? '⏳ ' : '❌ '}Status: {status}
                          </span>
                        </div>
                      )}
                      
                      {!completedSteps.has('product-catalog') && status !== "In Progress" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#FEF7E0',
                            color: '#9C6500',
                            border: '1px solid #FCD34D'
                          }}>
                            Required First
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={downloadProducts}
                    primary={!completedSteps.has('product-catalog')}
                    fullWidth
                    size="large"
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
                  border: completedSteps.has('create-embeddings') ? '2px solid #00A651' : '1px solid #E1E3E5',
                  borderRadius: '16px',
                  padding: '32px',
                  position: 'relative',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  opacity: canCreateEmbeddings ? 1 : 0.6,
                  transition: 'all 0.2s ease'
                }}>
                  {/* Step number badge */}
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: completedSteps.has('create-embeddings') ? '#00A651' : '#7b1fa2',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {completedSteps.has('create-embeddings') ? '✓' : '2'}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      backgroundColor: '#F3E5F5',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      🧠
                    </div>
                    <div>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Create Product Embeddings</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '4px' }}>
                        Generate AI embeddings for your products to enable smart voice search and recommendations.
                      </Text>
                      
                      {/* Status badge */}
                      {completedSteps.has('create-embeddings') ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#F0FDF4',
                            color: '#166534',
                            border: '1px solid #BBF7D0'
                          }}>
                            ✓ Completed
                          </span>
                        </div>
                      ) : !canCreateEmbeddings ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#FEF7E0',
                            color: '#9C6500',
                            border: '1px solid #FCD34D'
                          }}>
                            Complete Step 1 First
                          </span>
                        </div>
                      ) : status && currentTaskType === "create-embeddings" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: status === 'In Progress' ? '#FEF7E0' : '#FEF2F2',
                            color: status === 'In Progress' ? '#9C6500' : '#DC2626',
                            border: status === 'In Progress' ? '1px solid #FCD34D' : '1px solid #FECACA'
                          }}>
                            {status === 'In Progress' ? '⏳ ' : '❌ '}Status: {status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={createEmbeddings}
                    primary={canCreateEmbeddings && !completedSteps.has('create-embeddings')}
                    fullWidth
                    size="large"
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
            </div>
          </Card>
        </div>

        {/* Optional Actions */}
        <Card>
          <div style={{ padding: '24px' }}>
            <Text variant="headingLg" as="h2" fontWeight="semibold">Optional Actions</Text>
            <Text variant="bodyMd" color="subdued" style={{ marginTop: '8px', marginBottom: '32px' }}>
              These actions can be performed at any time
            </Text>
            
            <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
              {/* Delete Embeddings */}
              <div style={{
                border: '1px solid #E1E3E5',
                borderRadius: '16px',
                padding: '32px',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: '#FFEBEE',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginRight: '16px',
                    flexShrink: 0
                  }}>
                    🗑️
                  </div>
                  <div>
                    <Text variant="headingMd" as="h3" fontWeight="semibold">Delete Product Embeddings</Text>
                    <Text variant="bodyMd" color="subdued" style={{ marginTop: '4px' }}>
                      Remove product embeddings from the server. Use this to reset or clean up your data.
                    </Text>
                    {status && currentTaskType === "delete-embeddings" && (
                      <div style={{ marginTop: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: status === 'Completed' ? '#F0FDF4' : '#FEF7E0',
                          color: status === 'Completed' ? '#166534' : '#9C6500',
                          border: status === 'Completed' ? '1px solid #BBF7D0' : '1px solid #FCD34D'
                        }}>
                          {status === 'Completed' ? '✓ ' : '⏳ '}Status: {status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={deleteEmbeddings}
                  destructive
                  fullWidth
                  size="large"
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
                border: '1px solid #E1E3E5',
                borderRadius: '16px',
                padding: '32px',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: '#E8F5E8',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginRight: '16px',
                    flexShrink: 0
                  }}>
                    💡
                  </div>
                  <div>
                    <Text variant="headingMd" as="h3" fontWeight="semibold">Create System Prompt</Text>
                    <Text variant="bodyMd" color="subdued" style={{ marginTop: '4px' }}>
                      Generate and save a system prompt with relevant shop assortment for better AI responses.
                    </Text>
                  </div>
                </div>
                
                <Button 
                  onClick={fetchStoreInfoAndTags} 
                  primary
                  fullWidth
                  size="large"
                >
                  Create Prompt
                </Button>
              </div>
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
