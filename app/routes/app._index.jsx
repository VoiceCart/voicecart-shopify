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
        // Mark this step as completed
        setCompletedSteps(prev => new Set([...prev, 'create-prompt']));
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
    if (!taskId) return;
    const interval = setInterval(async () => {
      const response = await fetchWithToken(`/api/status-task?taskId=${taskId}`);
      const data = await response.json();
  
      if (data.status === "success" || data.status === "error") {
        const newStatus = data.status === "success" ? "Completed" : "Failed";
        setStatus(newStatus);
  
        if (data.status === "success") {
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
  
      } else if (["pending", "started", "progress"].includes(data.status)) {
        setStatus("In Progress");
        if (typeof data.progress === "number") {
          setProgress(data.progress);
        }
        if (data.message) {
          setProgressText(data.message);
        }
  
      } else if (data.error) {
        setStatus("Failed");
        showToast(data.error);
        setShowProgress(false);
        localStorage.removeItem("taskId");
        localStorage.removeItem("taskType");
        clearInterval(interval);
      }
    }, 1000);
  
    return () => clearInterval(interval);
  }, [taskId, currentTaskType, showToast, completeProgress]);

  // Check step dependencies
  const canCreateEmbeddings = completedSteps.has('product-catalog');
  const canCreatePrompt = completedSteps.has('create-embeddings');

  const pageStyle = {
    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    minHeight: '100vh',
    padding: '24px'
  };

  return (
    <Frame>
      <div style={pageStyle}>
        <Page title="VoiceCart - Admin panel">
          <TitleBar title="VoiceCart - Admin panel" primaryAction={null} />

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

          {/* Setup Steps - Now in a grid layout */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ 
              display: 'grid', 
              gap: '24px', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))'
            }}>
              {/* Step 1: Generate Product Catalog */}
              <div style={{
                border: completedSteps.has('product-catalog') ? '2px solid #00A651' : '1px solid #d1d5db',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                {/* Step number badge */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: completedSteps.has('product-catalog') ? '#00A651' : '#1976d2',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {completedSteps.has('product-catalog') ? '✓' : '1'}
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#dbeafe',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      📦
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Generate Product Catalog</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '12px' }}>
                        Create and store your product catalog on the server. This is the first step in setting up your VoiceCart.
                      </Text>
                      
                      {/* Status badge */}
                      {completedSteps.has('product-catalog') ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0'
                          }}>
                            ✓ Completed
                          </span>
                        </div>
                      ) : status && currentTaskType === "product-catalog" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: status === 'In Progress' ? '#fef3c7' : '#fee2e2',
                            color: status === 'In Progress' ? '#92400e' : '#dc2626',
                            border: '1px solid #fcd34d'
                          }}>
                            {status === 'In Progress' ? '⏳ ' : '❌ '}Status: {status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
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
                    style={{ backgroundColor: '#1976d2 !important', borderColor: '#1976d2 !important', color: 'white !important' }}
                  >
                    Generate Product Catalog
                  </Button>
                </div>
              </div>

              {/* Step 2: Create Product Embeddings */}
              <div style={{
                border: completedSteps.has('create-embeddings') ? '2px solid #00A651' : '1px solid #d1d5db',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                opacity: canCreateEmbeddings ? 1 : 0.6,
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                {/* Step number badge */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: completedSteps.has('create-embeddings') ? '#00A651' : '#7b1fa2',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {completedSteps.has('create-embeddings') ? '✓' : '2'}
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#f3e8ff',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      🧠
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Create Product Embeddings</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '12px' }}>
                        Generate AI embeddings for your products to enable smart voice search and recommendations.
                      </Text>
                      
                      {/* Status badge */}
                      {completedSteps.has('create-embeddings') ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0'
                          }}>
                            ✓ Completed
                          </span>
                        </div>
                      ) : !canCreateEmbeddings ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d'
                          }}>
                            Complete Step 1 First
                          </span>
                        </div>
                      ) : status && currentTaskType === "create-embeddings" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: status === 'In Progress' ? '#fef3c7' : '#fee2e2',
                            color: status === 'In Progress' ? '#92400e' : '#dc2626',
                            border: '1px solid #fcd34d'
                          }}>
                            {status === 'In Progress' ? '⏳ ' : '❌ '}Status: {status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
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
                    style={{ backgroundColor: '#7b1fa2 !important', borderColor: '#7b1fa2 !important', color: 'white !important' }}
                  >
                    Create Product Embeddings
                  </Button>
                </div>
              </div>

              {/* Step 3: Create System Prompt */}
              <div style={{
                border: completedSteps.has('create-prompt') ? '2px solid #00A651' : '1px solid #d1d5db',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                opacity: canCreatePrompt ? 1 : 0.6,
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                {/* Step number badge */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: completedSteps.has('create-prompt') ? '#00A651' : '#f57c00',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {completedSteps.has('create-prompt') ? '✓' : '3'}
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#ecfdf5',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      💡
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Create System Prompt</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '12px' }}>
                        Generate and save a system prompt with relevant shop assortment for better AI responses.
                      </Text>
                      
                      {/* Status badge */}
                      {completedSteps.has('create-prompt') ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0'
                          }}>
                            ✓ Completed
                          </span>
                        </div>
                      ) : !canCreatePrompt ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d'
                          }}>
                            Complete Step 2 First
                          </span>
                        </div>
                      ) : showProgress && currentTaskType === 'create-prompt' ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d'
                          }}>
                            ⏳ Creating Prompt...
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Button
                    onClick={fetchStoreInfoAndTags}
                    primary={canCreatePrompt && !completedSteps.has('create-prompt')}
                    fullWidth
                    size="large"
                    disabled={!canCreatePrompt || (showProgress && currentTaskType === 'create-prompt')}
                    loading={showProgress && currentTaskType === 'create-prompt'}
                    style={{ backgroundColor: '#f57c00 !important', borderColor: '#f57c00 !important', color: 'white !important' }}
                  >
                    Create System Prompt
                  </Button>
                </div>
              </div>

              {/* Delete Embeddings */}
              <div style={{
                border: '1px solid #d1d5db',
                borderRadius: '16px',
                padding: '24px',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#fef2f2',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      🗑️
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text variant="headingMd" as="h3" fontWeight="semibold">Delete Product Embeddings</Text>
                      <Text variant="bodyMd" color="subdued" style={{ marginTop: '12px' }}>
                        Remove product embeddings from the server. Use this to reset or clean up your data.
                      </Text>
                      {status && currentTaskType === "delete-embeddings" && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: status === 'Completed' ? '#dcfce7' : '#fef3c7',
                            color: status === 'Completed' ? '#166534' : '#92400e',
                            border: '1px solid #bbf7d0'
                          }}>
                            {status === 'Completed' ? '✓ ' : '⏳ '}Status: {status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
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
                    style={{ backgroundColor: '#ef5350 !important', borderColor: '#ef5350 !important', color: 'white !important' }}
                  >
                    Delete Product Embeddings
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Actions */}
          <div style={{ 
            display: 'grid', 
            gap: '24px', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))'
          }}>
            <Text variant="headingLg" as="h2" fontWeight="semibold" style={{ gridColumn: '1 / -1' }}>
              Optional Actions
            </Text>
          </div>
        </Page>
      </div>

      {toast.active && (
        <Toast content={toast.content} onDismiss={handleToastDismiss} duration={4000} />
      )}
    </Frame>
  );
}
