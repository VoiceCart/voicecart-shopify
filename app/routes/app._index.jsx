import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Page,
  Text,
  Frame,
  Toast,
  Tabs,
} from "@shopify/polaris";
import { fetchWithToken } from "../utils/fetchWithToken.client";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const apiKey = "369704dc668e71476bbd3055292fd72e";

export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    let shopDomain = session.shop.trim().toLowerCase();
    if (!shopDomain.endsWith(".myshopify.com")) {
      shopDomain += ".myshopify.com";
    }
    return json({ shopDomain });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: "Failed to fetch shop domain" }, { status: 500 });
  }
}

export default function DownloadProducts() {
  const { shopDomain, error } = useLoaderData();
  const fetcher = useFetcher();
  const app = useAppBridge();
  const [activeTab, setActiveTab] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState("");
  const [currentTaskType, setCurrentTaskType] = useState(null);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [toast, setToast] = useState({ active: false, content: "" });
  const [deeplinkUrl, setDeeplinkUrl] = useState(null);

  const [faqText, setFaqText] = useState("");
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [faqSaved, setFaqSaved] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Chat states
  const [chatData, setChatData] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  const showToast = useCallback((content) => setToast({ active: true, content }), []);
  const handleToastDismiss = useCallback(() => setToast({ ...toast, active: false }), [toast]);

  const isLoading = fetcher.state === "loading" || fetcher.state === "submitting";

  const tabs = [
    {
      id: 'catalog',
      content: 'Catalog Configuration',
      accessibilityLabel: 'Catalog Configuration',
      panelID: 'catalog-panel',
    },
    {
      id: 'faq',
      content: 'FAQ Management',
      accessibilityLabel: 'FAQ Management', 
      panelID: 'faq-panel',
    },
    {
      id: 'chats',
      content: 'Customer Chats',
      accessibilityLabel: 'Customer Chats',
      panelID: 'chats-panel',
    },
    {
      id: 'widget',
      content: 'Widget Setup',
      accessibilityLabel: 'Widget Setup',
      panelID: 'widget-panel',
    },
  ];

  const getProgressMessages = (taskType) => {
    const messages = {
      "product-catalog": [
        "Connecting to product database...",
        "Fetching product information...",
        "Processing product data...",
        "Generating catalog structure...",
        "Saving catalog to server...",
        "Product catalog generated successfully!",
      ],
      "create-embeddings": [
        "Initializing AI model...",
        "Processing product descriptions...",
        "Generating embeddings...",
        "Optimizing search vectors...",
        "Storing embeddings...",
        "Product embeddings created successfully!",
      ],
      "delete-embeddings": [
        "Connecting to server...",
        "Locating embedding files...",
        "Removing embeddings...",
        "Cleaning up references...",
        "Embeddings deleted successfully!",
      ],
      "create-prompt": [
        "Analyzing product catalog...",
        "Generating system prompt...",
        "Optimizing for voice interaction...",
        "Saving prompt configuration...",
        "System prompt created successfully!",
      ],
    };
    return messages[taskType] || ["Processing..."];
  };

  const simulateProgress = useCallback((taskType) => {
    setShowProgress(true);
    setProgress(0);

    const messages = getProgressMessages(taskType);
    let currentProgress = 0;

    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5;
      if (currentProgress > 95) currentProgress = 95;

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
    const progressInterval = simulateProgress("create-prompt");

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
        completeProgress("create-prompt");
        setCompletedSteps((prev) => new Set([...prev, "create-prompt"]));
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

  const saveFaq = async () => {
    setIsSavingFaq(true);
    setFaqSaved(false);
    
    try {
      const response = await fetchWithToken("/api/save-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faq: faqText }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFaqSaved(true);
        showToast("FAQ saved successfully!");
        setTimeout(() => setFaqSaved(false), 3000);
      } else {
        showToast(`Error: ${data.error || "Failed to save FAQ"}`);
      }
    } catch (error) {
      console.error("Error saving FAQ:", error);
      showToast("Error saving FAQ");
    } finally {
      setIsSavingFaq(false);
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

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    setIsChatPanelOpen(true);
  };

  const closeChatPanel = () => {
    setIsChatPanelOpen(false);
    setSelectedChat(null);
  };

  const loadAllSessions = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const response = await fetchWithToken("/api/get-all-sessions", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (response.ok && data.sessions) {
        setChatData(data.sessions);
        showToast(`Loaded ${data.sessions.length} chat sessions`);
      } else {
        console.error("Error loading sessions:", data);
        showToast(`Error: ${data.error || "Failed to load chat sessions"}`);
      }
    } catch (error) {
      console.error("Network error loading sessions:", error);
      showToast("Error loading chat sessions");
    } finally {
      setIsLoadingChats(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (fetcher.data?.taskId) {
      const { taskId, taskType } = fetcher.data;
      setTaskId(taskId);
      setCurrentTaskType(taskType);
      setStatus("In Progress");
      localStorage.setItem("taskId", taskId);
      localStorage.setItem("taskType", taskType);
      showToast(`${taskType === "product-catalog" ? "Download" : "Embedding"} started...`);
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
          setCompletedSteps((prev) => new Set([...prev, currentTaskType]));
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

  const canCreateEmbeddings = completedSteps.has("product-catalog");
  const canCreatePrompt = completedSteps.has("create-embeddings");

  const pageStyle = {
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
    minHeight: "100vh",
    padding: "24px",
  };

  const redirectTo = useCallback(
    (url) => {
      if (!app) {
        console.error("App Bridge not initialized");
        showToast("Error: App Bridge not initialized");
        return;
      }
      
      try {
        const redirect = Redirect.create(app);
        redirect.dispatch(Redirect.Action.REMOTE, url);
      } catch (error) {
        console.error("Redirect error:", error);
        window.open(url, '_blank');
      }
    },
    [app, showToast]
  );

  useEffect(() => {
    if (error) {
      showToast("Error: Unable to retrieve shop domain");
      return;
    }

    if (shopDomain && apiKey) {
      const customizeUrl = `https://${shopDomain}/admin/themes/current/editor?template=index&addAppBlockId=${apiKey}/app-window&target=sectionGroup:footer`;
      setDeeplinkUrl(customizeUrl);
    } else {
      showToast("Error: Missing shop domain or API key");
    }
  }, [shopDomain, error, showToast]);

  useEffect(() => {
    const loadFaq = async () => {
      try {
        const response = await fetchWithToken("/api/get-faq");
        const data = await response.json();
        
        if (response.ok && data.faq) {
          setFaqText(data.faq);
        }
      } catch (error) {
        console.error("Error loading FAQ:", error);
      }
    };
    
    loadFaq();
  }, []);

  useEffect(() => {
    if (activeTab === 2) {
      loadAllSessions();
    }
  }, [activeTab, loadAllSessions]);

  const renderCatalogTab = () => (
    <div>
      {showProgress && (
        <div style={{ marginBottom: "24px" }}>
          <Card sectioned>
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#f1f2f3",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: "linear-gradient(90deg, #008060, #00a67c)",
                    borderRadius: "4px",
                    width: `${progress}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
            <Text variant="bodyMd" color="subdued" alignment="center">
              {progressText}
            </Text>
          </Card>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        }}
      >
        <div
          style={{
            border:
              completedSteps.has("product-catalog")
                ? "2px solid #00A651"
                : "1px solid #d1d5db",
            borderRadius: "16px",
            padding: "24px",
            position: "relative",
            backgroundColor: "white",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "200px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: completedSteps.has("product-catalog")
                ? "#00A651"
                : "#1976d2",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {completedSteps.has("product-catalog") ? "✓" : "1"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#dbeafe",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  marginRight: "16px",
                  flexShrink: 0,
                }}
              >
                📦
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  variant="headingMd"
                  as="h3"
                  fontWeight="semibold"
                >
                  Generate Product Catalog
                </Text>
                <Text
                  variant="bodyMd"
                  color="subdued"
                  style={{ marginTop: "8px" }}
                >
                  Create and store your product catalog on the server.
                  This is the first step in setting up your VoiceCart.
                </Text>
                {completedSteps.has("product-catalog") ? (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      ✓ Completed
                    </span>
                  </div>
                ) : status &&
                  currentTaskType === "product-catalog" && (
                    <div style={{ marginTop: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 12px",
                          borderRadius: "16px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor:
                            status === "In Progress"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            status === "In Progress"
                              ? "#92400e"
                              : "#dc2626",
                          border:
                            status === "In Progress"
                              ? "1px solid #fcd34d"
                              : "1px solid #fecaca",
                        }}
                      >
                        {status === "In Progress" ? "⏳ " : "❌ "}
                        Status: {status}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div>
            <Button
              onClick={downloadProducts}
              primary={!completedSteps.has("product-catalog")}
              fullWidth
              size="large"
              loading={
                (isLoading && currentTaskType === "product-catalog") ||
                (status === "In Progress" &&
                  currentTaskType === "product-catalog")
              }
              disabled={
                status === "In Progress" &&
                currentTaskType === "product-catalog"
              }
              style={{
                backgroundColor: "#1976d2",
                borderColor: "#1976d2",
                color: "white",
              }}
            >
              Generate Product Catalog
            </Button>
          </div>
        </div>

        <div
          style={{
            border:
              completedSteps.has("create-embeddings")
                ? "2px solid #00A651"
                : "1px solid #d1d5db",
            borderRadius: "16px",
            padding: "24px",
            position: "relative",
            backgroundColor: "white",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            opacity: canCreateEmbeddings ? 1 : 0.6,
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "200px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: completedSteps.has("create-embeddings")
                ? "#00A651"
                : "#7b1fa2",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {completedSteps.has("create-embeddings") ? "✓" : "2"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#f3e8ff",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  marginRight: "16px",
                  flexShrink: 0,
                }}
              >
                🧠
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  variant="headingMd"
                  as="h3"
                  fontWeight="semibold"
                >
                  Create Product Embeddings
                </Text>
                <Text
                  variant="bodyMd"
                  color="subdued"
                  style={{ marginTop: "8px" }}
                >
                  Generate AI embeddings for your products to enable
                  smart voice search and recommendations.
                </Text>
                {completedSteps.has("create-embeddings") ? (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      ✓ Completed
                    </span>
                  </div>
                ) : !canCreateEmbeddings ? (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fcd34d",
                      }}
                    >
                      Complete Step 1 First
                    </span>
                  </div>
                ) : status &&
                  currentTaskType === "create-embeddings" && (
                    <div style={{ marginTop: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 12px",
                          borderRadius: "16px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor:
                            status === "In Progress"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            status === "In Progress"
                              ? "#92400e"
                              : "#dc2626",
                          border:
                            status === "In Progress"
                              ? "1px solid #fcd34d"
                              : "1px solid #fecaca",
                        }}
                      >
                        {status === "In Progress" ? "⏳ " : "❌ "}
                        Status: {status}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div>
            <Button
              onClick={createEmbeddings}
              primary={
                canCreateEmbeddings &&
                !completedSteps.has("create-embeddings")
              }
              fullWidth
              size="large"
              disabled={
                !canCreateEmbeddings ||
                (status === "In Progress" &&
                  currentTaskType === "create-embeddings")
              }
              loading={
                (isLoading && currentTaskType === "create-embeddings") ||
                (status === "In Progress" &&
                  currentTaskType === "create-embeddings")
              }
              style={{
                backgroundColor: "#7b1fa2",
                borderColor: "#7b1fa2",
                color: "white",
              }}
            >
              Create Product Embeddings
            </Button>
          </div>
        </div>

        <div
          style={{
            border:
              completedSteps.has("create-prompt")
                ? "2px solid #00A651"
                : "1px solid #d1d5db",
            borderRadius: "16px",
            padding: "24px",
            position: "relative",
            backgroundColor: "white",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            opacity: canCreatePrompt ? 1 : 0.6,
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "200px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: completedSteps.has("create-prompt")
                ? "#00A651"
                : "#f57c00",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {completedSteps.has("create-prompt") ? "✓" : "3"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#ecfdf5",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  marginRight: "16px",
                  flexShrink: 0,
                }}
              >
                💡
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  variant="headingMd"
                  as="h3"
                  fontWeight="semibold"
                >
                  Create System Prompt
                </Text>
                <Text
                  variant="bodyMd"
                  color="subdued"
                  style={{ marginTop: "8px" }}
                >
                  Generate and save a system prompt with relevant shop
                  assortment for better AI responses.
                  </Text>
                {completedSteps.has("create-prompt") ? (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      ✓ Completed
                    </span>
                  </div>
                ) : !canCreatePrompt ? (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fcd34d",
                      }}
                    >
                      Complete Steps 1 & 2 First
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: "#dbeafe",
                        color: "#1e40af",
                        border: "1px solid #93c5fd",
                      }}
                    >
                      Ready to Generate
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <Button
              onClick={fetchStoreInfoAndTags}
              primary={
                canCreatePrompt && !completedSteps.has("create-prompt")
              }
              fullWidth
              size="large"
              disabled={!canCreatePrompt}
              style={{
                backgroundColor: "#f57c00",
                borderColor: "#f57c00",
                color: "white",
              }}
            >
              Create System Prompt
            </Button>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "16px",
            padding: "24px",
            position: "relative",
            backgroundColor: "white",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "200px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#fef2f2",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  marginRight: "16px",
                  flexShrink: 0,
                }}
              >
                🗑️
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  variant="headingMd"
                  as="h3"
                  fontWeight="semibold"
                >
                  Delete Embeddings
                </Text>
                <Text
                  variant="bodyMd"
                  color="subdued"
                  style={{ marginTop: "8px" }}
                >
                  Remove existing product embeddings from the server.
                  Use this if you need to regenerate them.
                </Text>
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
                (status === "In Progress" &&
                  currentTaskType === "delete-embeddings")
              }
              disabled={
                status === "In Progress" &&
                currentTaskType === "delete-embeddings"
              }
            >
              Delete Embeddings
            </Button>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "16px",
            padding: "24px",
            backgroundColor: "white",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#f0f9ff",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                marginRight: "16px",
                flexShrink: 0,
              }}
            >
              🌐
            </div>
            <div style={{ flex: 1 }}>
              <Text variant="headingMd" as="h3" fontWeight="semibold">
                Set Global Language
              </Text>
              <Text
                variant="bodyMd"
                color="subdued"
                style={{ marginTop: "8px" }}
              >
                Configure the default language for your VoiceCart
                assistant.
              </Text>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              style={{
                flex: 1,
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                backgroundColor: "white",
              }}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
            </select>
            <Button
              onClick={setGlobalLanguage}
              primary
              loading={isLoading}
              style={{
                backgroundColor: "#0ea5e9",
                borderColor: "#0ea5e9",
              }}
            >
              Set Language
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFaqTab = () => (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Card sectioned>
        <div style={{ marginBottom: "16px" }}>
          <Text variant="headingMd" as="h3" fontWeight="semibold">
            FAQ Management
          </Text>
          <Text variant="bodyMd" color="subdued" style={{ marginTop: "8px" }}>
            Configure frequently asked questions for your VoiceCart assistant.
          </Text>
        </div>
        
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="faq-textarea"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            FAQ Content
          </label>
          <textarea
            id="faq-textarea"
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            placeholder="Enter your FAQ content here..."
            style={{
              width: "100%",
              minHeight: "300px",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Button
            onClick={saveFaq}
            primary
            loading={isSavingFaq}
            style={{
              backgroundColor: "#10b981",
              borderColor: "#10b981",
            }}
          >
            Save FAQ
          </Button>
          
          {faqSaved && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 12px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor: "#dcfce7",
                color: "#166534",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓ Saved Successfully
            </span>
          )}
        </div>
      </Card>
    </div>
  );

  const renderChatsTab = () => (
    <div style={{ position: "relative", height: "calc(100vh - 200px)" }}>
      <div
        style={{
          display: "flex",
          height: "100%",
          gap: "20px",
          transition: "all 0.3s ease",
        }}
      >
        {/* Chat List */}
        <div
          style={{
            flex: isChatPanelOpen ? "0 0 60%" : "1",
            transition: "flex 0.3s ease",
          }}
        >
          <Card>
            <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text variant="headingMd" as="h3" fontWeight="semibold">
                    Customer Chats
                  </Text>
                  <Text variant="bodyMd" color="subdued" style={{ marginTop: "4px" }}>
                    Click on any chat to view the conversation
                  </Text>
                </div>
                <Button
                  onClick={loadAllSessions}
                  loading={isLoadingChats}
                  size="small"
                >
                  Refresh
                </Button>
              </div>
            </div>
            
            <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
              {isLoadingChats ? (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <Text variant="bodyMd" color="subdued">
                    Loading chat sessions...
                  </Text>
                </div>
              ) : chatData.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <Text variant="bodyMd" color="subdued">
                    No chat sessions found. Start a conversation with your customers to see them here.
                  </Text>
                </div>
              ) : (
                chatData.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleChatSelect(chat)}
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      transition: "background-color 0.2s ease",
                      backgroundColor: selectedChat?.id === chat.id ? "#f0f9ff" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedChat?.id !== chat.id) {
                        e.target.style.backgroundColor = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedChat?.id !== chat.id) {
                        e.target.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <Text variant="bodyMd" fontWeight="semibold">
                          Session: {chat.sessionId}
                        </Text>
                        <Text variant="bodySm" color="subdued" style={{ marginTop: "2px" }}>
                          {chat.messageCount} messages
                        </Text>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text variant="bodySm" color="subdued">
                          {chat.date}
                        </Text>
                        <Text variant="bodySm" color="subdued" style={{ marginTop: "2px" }}>
                          {chat.time}
                        </Text>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Chat Detail Panel */}
        {isChatPanelOpen && selectedChat && (
          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Card>
              {/* Chat Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Text variant="headingSm" fontWeight="semibold">
                    {selectedChat.sessionId}
                  </Text>
                  <Text variant="bodySm" color="subdued">
                    {selectedChat.date} at {selectedChat.time}
                  </Text>
                </div>
                <Button
                  onClick={closeChatPanel}
                  plain
                  style={{ padding: "4px" }}
                >
                  ✕
                </Button>
              </div>

              {/* Chat Messages */}
              <div
                style={{
                  height: "calc(100vh - 380px)",
                  overflowY: "auto",
                  padding: "16px 20px",
                }}
              >
                {selectedChat.messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <Text variant="bodyMd" color="subdued">
                      No messages in this session
                    </Text>
                  </div>
                ) : (
                  selectedChat.messages.map((message, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: "16px",
                        display: "flex",
                        flexDirection: message.type === "user" ? "row-reverse" : "row",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: message.type === "user" ? "#3b82f6" : "#10b981",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        {message.type === "user" ? "👤" : "🤖"}
                      </div>
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "12px 16px",
                          borderRadius: "16px",
                          backgroundColor: message.type === "user" ? "#3b82f6" : "#f3f4f6",
                          color: message.type === "user" ? "white" : "#374151",
                          fontSize: "14px",
                          lineHeight: "1.4",
                        }}
                      >
                        <div>{message.text}</div>
                        <div
                          style={{
                            fontSize: "12px",
                            marginTop: "4px",
                            opacity: 0.7,
                          }}
                        >
                          {message.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );

  const renderWidgetTab = () => (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Card sectioned>
        <div style={{ marginBottom: "24px" }}>
          <Text variant="headingMd" as="h3" fontWeight="semibold">
            Widget Setup
          </Text>
          <Text variant="bodyMd" color="subdued" style={{ marginTop: "8px" }}>
            Add the VoiceCart widget to your store theme.
          </Text>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <Text variant="headingSm" fontWeight="semibold" style={{ marginBottom: "12px" }}>
              📺 Setup Video Tutorial
            </Text>
            <div
              style={{
                backgroundColor: "#1f2937",
                borderRadius: "8px",
                padding: "40px",
                textAlign: "center",
                color: "white",
                marginBottom: "16px",
              }}
            >
                <iframe
                  width="100%"
                  height="315"
                  style={{ display: "block", border: "none" }}
                  src="https://www.youtube.com/embed/UxginYhvU7Y?si=qPY4qQu3x3C6rPfh"
                  title="VoiceCart Setup"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <Text variant="headingSm" fontWeight="semibold" style={{ marginBottom: "12px" }}>
            📋 Setup Instructions
          </Text>
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <ol style={{ margin: 0, paddingLeft: "20px" }}>
              <li style={{ marginBottom: "8px" }}>
                <Text variant="bodyMd">
                  Complete the Catalog Configuration steps first
                </Text>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <Text variant="bodyMd">
                  Click the "Open Theme Customizer" button below
                </Text>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <Text variant="bodyMd">
                  Add the VoiceCart app block to your theme
                </Text>
              </li>
              <li>
                <Text variant="bodyMd">
                  Save and publish your theme changes
                </Text>
              </li>
            </ol>
          </div>
        </div>

        <div>
          <Button
            onClick={() => redirectTo(deeplinkUrl)}
            primary
            size="large"
            disabled={!deeplinkUrl}
            style={{
              backgroundColor: "#7c3aed",
              borderColor: "#7c3aed",
            }}
          >
            Open Theme Customizer
          </Button>
        </div>
      </Card>
    </div>
  );

  if (error) {
    return (
      <Page title="VoiceCart Setup">
        <Frame>
          <Card sectioned>
            <Text variant="bodyMd" color="critical">
              Error: {error}
            </Text>
          </Card>
          {toast.active && (
            <Toast content={toast.content} onDismiss={handleToastDismiss} />
          )}
        </Frame>
      </Page>
    );
  }

  return (
    <div style={pageStyle}>
      <Page title="VoiceCart Setup">
        <TitleBar title="VoiceCart Configuration" />
        <Frame>
          <Card>
            <Tabs tabs={tabs} selected={activeTab} onSelect={setActiveTab}>
              <div style={{ padding: "24px" }}>
                {activeTab === 0 && renderCatalogTab()}
                {activeTab === 1 && renderFaqTab()}
                {activeTab === 2 && renderChatsTab()}
                {activeTab === 3 && renderWidgetTab()}
              </div>
            </Tabs>
          </Card>
          {toast.active && (
            <Toast content={toast.content} onDismiss={handleToastDismiss} />
          )}
        </Frame>
      </Page>
    </div>
  );
}