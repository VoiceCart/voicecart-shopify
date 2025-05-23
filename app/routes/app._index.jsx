import { useFetcher } from "@remix-run/react";
import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Page,
  Text,
  Select,
  Frame,
  Toast,
  ProgressBar,
  Badge,
  Icon
} from "@shopify/polaris";
import { Stack } from '@shopify/polaris/build/esm/components/Stack';
import { TitleBar } from "@shopify/app-bridge-react";
import { fetchWithToken } from "../utils/fetchWithToken.client";
import {
  ProductsIcon,
  BrainIcon,
  DeleteIcon,
  LightbulbIcon
} from '@shopify/polaris-icons';

export default function DownloadProducts() {
  const fetcher = useFetcher();
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState("");
  const [currentTaskType, setCurrentTaskType] = useState(null);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [toast, setToast] = useState({ active: false, content: "" });
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [completedSteps, setCompletedSteps] = useState({
    'product-catalog': false,
    'create-embeddings': false
  });

  const showToast = useCallback(
    (content) => setToast({ active: true, content }),
    []
  );
  const handleToastDismiss = useCallback(
    () => setToast({ ...toast, active: false }),
    [toast]
  );

  const isLoading = fetcher.state === "loading" || fetcher.state === "submitting";

  const startTask = (taskType) => {
    fetcher.submit({ taskType }, { method: "POST", action: "/api/start-task" });
  };

  const downloadProducts = () => startTask("product-catalog");
  const createEmbeddings = () => startTask("create-embeddings");
  const deleteEmbeddings = () => startTask("delete-embeddings");

  const fetchStoreInfoAndTags = async () => {
    setCurrentTaskType("create-prompt");
    setProgress(0);
    setProgressText("Analyzing product catalog...");
    
    try {
      setProgress(25);
      setProgressText("Fetching store information...");
      
      const response = await fetchWithToken("/api/generate-prompt", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log("Shop Description:", data.shopDescription);
        console.log("Unique Tags:", data.uniqueTags);
        setProgress(60);
        setProgressText("Generating system prompt...");
        showToast("Store info and tags printed to console. Fetching prompt...");
        await fetchPromptFromDB();
      } else {
        console.error("Error response from server:", data);
        showToast(`Error: ${data.error || "Failed to fetch store info"}`);
        setCurrentTaskType(null);
      }
    } catch (error) {
      console.error("Network error fetching store info:", error);
      showToast("Error processing store info");
      setCurrentTaskType(null);
    }
  };

  const fetchPromptFromDB = async () => {
    try {
      setProgress(80);
      setProgressText("Saving prompt configuration...");
      
      const response = await fetchWithToken("/api/get-saved-prompt", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (response.ok && data.generalPrompt) {
        console.log("Generated Store Prompt (from DB):", data.generalPrompt);
        setProgress(100);
        setProgressText("System prompt created successfully!");
        showToast("Prompt successfully retrieved from database and printed");
        
        setTimeout(() => {
          setCurrentTaskType(null);
          setProgress(0);
          setProgressText("");
        }, 2000);
      } else {
        console.error("No prompt found in DB or error:", data);
        showToast(`Error: ${data.error || "Prompt not found in DB"}`);
        setCurrentTaskType(null);
      }
    } catch (error) {
      console.error("Network error fetching prompt from DB:", error);
      showToast("Error fetching prompt from database");
      setCurrentTaskType(null);
    }
  };

  const setGlobalLanguage = () => {
    fetcher.submit(
      { language: defaultLanguage },
      { method: "POST", action: "/api/set-global-language" }
    );
  };

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
      ]
    };
    return messages[taskType] || [];
  };

  const simulateProgress = (taskType) => {
    const messages = getProgressMessages(taskType);
    let currentProgress = 0;
    let messageIndex = 0;
    
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5;
      if (currentProgress > 100) currentProgress = 100;
      
      messageIndex = Math.min(Math.floor(currentProgress / 20), messages.length - 1);
      setProgress(currentProgress);
      setProgressText(messages[messageIndex] || 'Processing...');
      
      if (currentProgress >= 100) {
        clearInterval(interval);
      }
    }, 300);
    
    return interval;
  };

  useEffect(() => {
    if (fetcher.data?.taskId) {
      const { taskId, taskType } = fetcher.data;
      setTaskId(taskId);
      setCurrentTaskType(taskType);
      setStatus("In Progress");
      localStorage.setItem("taskId", taskId);
      localStorage.setItem("taskType", taskType);
      
      // Start progress simulation
      simulateProgress(taskType);
      
      showToast(
        `${taskType === "product-catalog" ? "Download" : "Embedding"} started...`
      );
    } else if (fetcher.data?.error) {
      setStatus("Failed");
      setCurrentTaskType(null);
      showToast(fetcher.data.error);
    } else if (fetcher.data?.success) {
      showToast(`Global language set to ${defaultLanguage}`);
    }
  }, [fetcher.data, showToast, defaultLanguage]);

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
          setStatus(data.status === "success" ? "Completed" : "Failed");
          
          if (data.status === "success") {
            setProgress(100);
            const messages = getProgressMessages(currentTaskType);
            setProgressText(messages[messages.length - 1] || 'Completed successfully!');
            
            // Mark step as completed
            setCompletedSteps(prev => ({
              ...prev,
              [currentTaskType]: true
            }));
            
            setTimeout(() => {
              setCurrentTaskType(null);
              setProgress(0);
              setProgressText("");
            }, 2000);
          } else {
            setCurrentTaskType(null);
            setProgress(0);
            setProgressText("");
          }
          
          showToast(
            `${currentTaskType === "product-catalog" ? "Download" : "Embedding"} ${data.status}!`
          );
          localStorage.removeItem("taskId");
          localStorage.removeItem("taskType");
          clearInterval(interval);
        } else if (data.error) {
          setStatus("Failed");
          setCurrentTaskType(null);
          setProgress(0);
          setProgressText("");
          showToast(data.error);
          localStorage.removeItem("taskId");
          localStorage.removeItem("taskType");
          clearInterval(interval);
        } else {
          setStatus("In Progress");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [taskId, currentTaskType, showToast]);

  const isStepLoading = (stepType) => {
    return (isLoading && currentTaskType === stepType) ||
           (status === "In Progress" && currentTaskType === stepType);
  };

  const canCreateEmbeddings = completedSteps['product-catalog'] || status === "Completed";

  return (
    <Frame>
      <Page title="VoiceCart - Admin panel">
        <TitleBar title="Shopify Product Catalog Management" primaryAction={null} />

        {/* Language Settings */}
        <Card sectioned>
          <Stack vertical spacing="tight">
            <Text variant="headingMd">Global Language Settings</Text>
            <Text color="subdued">Set the default global language for your store.</Text>
            <Stack alignment="center">
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
              <Button onClick={setGlobalLanguage} primary disabled={isLoading}>
                Set Global Language
              </Button>
            </Stack>
          </Stack>
        </Card>

        {/* Progress Bar */}
        {currentTaskType && (
          <Card sectioned>
            <Stack vertical spacing="tight">
              <Text variant="headingMd">Processing...</Text>
              <ProgressBar progress={progress} size="large" />
              {progressText && (
                <Text color="subdued" alignment="center">{progressText}</Text>
              )}
            </Stack>
          </Card>
        )}

        {/* Required Steps */}
        <Card sectioned>
          <Stack vertical spacing="loose">
            <Text variant="headingLg">Setup Steps</Text>
            <Text color="subdued">Complete these steps in order to set up your VoiceCart.</Text>
            
            <Stack distribution="fillEvenly" spacing="loose">
              {/* Step 1: Generate Product Catalog */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="center">
                    <Icon source={ProductsIcon} color="primary" />
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd">Generate Product Catalog</Text>
                      <Badge status={completedSteps['product-catalog'] ? 'success' : 'attention'}>
                        {completedSteps['product-catalog'] ? 'Completed' : 'Step 1'}
                      </Badge>
                    </Stack>
                  </Stack>
                  <Text color="subdued">
                    Create and store your product catalog on the server. This is the first step in setting up your VoiceCart.
                  </Text>
                  {status && currentTaskType === "product-catalog" && (
                    <Text color={status === "Completed" ? "success" : "subdued"}>
                      Catalog Status: {status}
                    </Text>
                  )}
                  <Button
                    onClick={downloadProducts}
                    primary
                    loading={isStepLoading("product-catalog")}
                    fullWidth
                  >
                    Generate Product Catalog
                  </Button>
                </Stack>
              </Card>

              {/* Step 2: Create Product Embeddings */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="center">
                    <Icon source={BrainIcon} color={canCreateEmbeddings ? "primary" : "subdued"} />
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd">Create Product Embeddings</Text>
                      <Badge status={completedSteps['create-embeddings'] ? 'success' : canCreateEmbeddings ? 'info' : 'attention'}>
                        {completedSteps['create-embeddings'] ? 'Completed' : canCreateEmbeddings ? 'Ready' : 'Step 2'}
                      </Badge>
                    </Stack>
                  </Stack>
                  <Text color="subdued">
                    Generate AI embeddings for your products to enable smart voice search and recommendations.
                  </Text>
                  {status && currentTaskType === "create-embeddings" && (
                    <Text color={status === "Completed" ? "success" : "subdued"}>
                      Embedding Status: {status}
                    </Text>
                  )}
                  <Button
                    onClick={createEmbeddings}
                    primary={canCreateEmbeddings}
                    disabled={!canCreateEmbeddings}
                    loading={isStepLoading("create-embeddings")}
                    fullWidth
                  >
                    Create Product Embeddings
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Stack>
        </Card>

        {/* Optional Actions */}
        <Card sectioned>
          <Stack vertical spacing="loose">
            <Text variant="headingLg">Optional Actions</Text>
            <Text color="subdued">These actions can be performed at any time.</Text>
            
            <Stack distribution="fillEvenly" spacing="loose">
              {/* Delete Embeddings */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="center">
                    <Icon source={DeleteIcon} color="critical" />
                    <Text variant="headingMd">Delete Product Embeddings</Text>
                  </Stack>
                  <Text color="subdued">
                    Remove product embeddings from the server. Use this to reset or clean up your data.
                  </Text>
                  {status && currentTaskType === "delete-embeddings" && (
                    <Text color={status === "Completed" ? "success" : "subdued"}>
                      Embedding Status: {status}
                    </Text>
                  )}
                  <Button
                    onClick={deleteEmbeddings}
                    destructive
                    loading={isStepLoading("delete-embeddings")}
                    fullWidth
                  >
                    Delete Product Embeddings
                  </Button>
                </Stack>
              </Card>

              {/* Create Prompt */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="center">
                    <Icon source={LightbulbIcon} color="primary" />
                    <Text variant="headingMd">Create System Prompt</Text>
                  </Stack>
                  <Text color="subdued">
                    Generate and save a system prompt with relevant shop assortment for better AI responses.
                  </Text>
                  <Button
                    onClick={fetchStoreInfoAndTags}
                    primary
                    loading={currentTaskType === "create-prompt"}
                    fullWidth
                  >
                    Create Prompt
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Stack>
        </Card>
      </Page>

      {toast.active && (
        <Toast content={toast.content} onDismiss={handleToastDismiss} duration={4000} />
      )}
    </Frame>
  );
}
