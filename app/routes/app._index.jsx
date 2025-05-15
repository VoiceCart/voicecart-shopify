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
      } else {
        console.error("Error response from server:", data);
        showToast(`Error: ${data.error || "Failed to fetch store info"}`);
      }
    } catch (error) {
      console.error("Network error fetching store info:", error);
      showToast("Error processing store info");
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
    } else if (fetcher.data?.error) {
      setStatus("Failed");
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
          clearInterval(interval);
        } else {
          setStatus("In Progress");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [taskId, currentTaskType, showToast]);

  return (
    <Frame>
      <Page title="VoiceCart - Admin panel">
        <TitleBar title="Shopify Product Catalog Management" primaryAction={null} />

        <Card sectioned>
          <Text>Set the default global language for your store.</Text>
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
        </Card>

        <ButtonGroup>
          <Card sectioned>
            <Text>Click to generate and store your product catalog on the server.</Text>
            {status && currentTaskType === "product-catalog" && (
              <Text>Catalog Status: {status}</Text>
            )}
            <Button
              onClick={downloadProducts}
              primary
              loading={
                (isLoading && currentTaskType === "product-catalog") ||
                (status === "In Progress" && currentTaskType === "product-catalog")
              }
            >
              Generate Product Catalog
            </Button>
          </Card>

          <Card sectioned>
            <Text>Click to create/update product embeddings.</Text>
            {status && currentTaskType === "create-embeddings" && (
              <Text>Embedding Status: {status}</Text>
            )}
            <Button
              onClick={createEmbeddings}
              primary
              loading={
                (isLoading && currentTaskType === "create-embeddings") ||
                (status === "In Progress" && currentTaskType === "create-embeddings")
              }
            >
              Create Product Embeddings
            </Button>
          </Card>

          <Card sectioned>
            <Text>Click to delete product embeddings from our server.</Text>
            {status && currentTaskType === "delete-embeddings" && (
              <Text>Embedding Status: {status}</Text>
            )}
            <Button
              onClick={deleteEmbeddings}
              primary
              loading={
                (isLoading && currentTaskType === "delete-embeddings") ||
                (status === "In Progress" && currentTaskType === "delete-embeddings")
              }
            >
              Delete Product Embeddings
            </Button>
          </Card>

          <Card sectioned>
            <Text>Click to create and save system prompt with relevant shop assortiment.</Text>
            <Button onClick={fetchStoreInfoAndTags} primary>
              Create Prompt
            </Button>
          </Card>
        </ButtonGroup>
      </Page>

      {toast.active && (
        <Toast content={toast.content} onDismiss={handleToastDismiss} duration={4000} />
      )}
    </Frame>
  );
}
