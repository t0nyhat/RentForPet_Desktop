import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import ClientFormModal, { type ClientFormData } from "./ClientFormModal";
import { PetFormModal, type PetFormData } from "./PetFormModal";
import AlertModal from "../AlertModal";
import { getGenderLabel, getSpeciesLabel } from "../../constants/pet";
import { useQueryClient } from "@tanstack/react-query";

type AdminClientPet = {
  id: string;
  clientId: string;
  name: string;
  species: number;
  gender: number;
  breed?: string | null;
  birthDate?: string | null;
  ageYears?: number | null;
  weight?: number | null;
  color?: string | null;
  microchip?: string | null;
  specialNeeds?: string | null;
  isActive: boolean;
  createdAt: string;
  internalNotes?: string | null;
};

type AdminClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string | null;
  internalNotes?: string | null;
  loyaltyDiscountPercent?: number;
  pets: AdminClientPet[];
  fullName?: string;
  searchable?: string;
};

type AdminClientsPanelProps = {
  clients: AdminClient[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
};

const AdminClientsPanel = ({ clients, loading, error, onRefresh }: AdminClientsPanelProps) => {
  const { authFetch } = useAuth();
  const { t } = useTranslation(["admin", "pet", "common"]);
  const queryClient = useQueryClient();
  void error;
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "pets" | "notes">("profile");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClientSnapshot, setEditClientSnapshot] = useState<AdminClient | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [petToDelete, setPetToDelete] = useState<string | null>(null);
  const [petToEdit, setPetToEdit] = useState<AdminClientPet | null>(null);

  // Notes states
  const [clientNotesDraft, setClientNotesDraft] = useState("");
  const [clientNotesSaving, setClientNotesSaving] = useState(false);
  const [clientNotesStatus, setClientNotesStatus] = useState<string | null>(null);
  const [petNotesDraft, setPetNotesDraft] = useState<Record<string, string>>({});
  const [petNotesSaving, setPetNotesSaving] = useState<Record<string, boolean>>({});
  const [petNotesStatus, setPetNotesStatus] = useState<Record<string, string | null>>({});

  // Success message state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Alert modal
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    message: "",
    type: "info",
  });
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper function to show success message with auto-dismiss
  const showSuccessMessage = useCallback((message: string) => {
    // Clear any existing timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(message);
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const normalizedClients = useMemo(() => {
    return clients.map((client) => {
      const fullName = `${client.lastName} ${client.firstName}`.trim();
      const searchable = [
        fullName,
        client.email,
        client.phone,
        client.address,
        ...client.pets.map((pet) => pet.name),
        ...client.pets.map((pet) => getSpeciesLabel(pet.species)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        ...client,
        fullName,
        searchable,
      };
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return normalizedClients;
    }
    return normalizedClients.filter((client) => client.searchable?.includes(query));
  }, [normalizedClients, search]);

  useEffect(() => {
    if (filteredClients.length === 0) {
      // Don't reset selectedClientId during loading - preserve it for when data returns
      // Only reset if there's no search and we truly have no clients
      if (!loading && !search.trim()) {
        setSelectedClientId(null);
      }
      return;
    }
    setSelectedClientId((prev) => {
      if (!prev) {
        return filteredClients[0].id;
      }
      const exists = filteredClients.some((client) => client.id === prev);
      return exists ? prev : filteredClients[0].id;
    });
  }, [filteredClients, loading, search]);

  const selectedClient = filteredClients.find((client) => client.id === selectedClientId) ?? null;

  const clientNotesChanged = selectedClient
    ? clientNotesDraft !== (selectedClient.internalNotes ?? "")
    : false;

  useEffect(() => {
    if (selectedClient) {
      setClientNotesDraft(selectedClient.internalNotes ?? "");
      const nextPetDrafts: Record<string, string> = {};
      selectedClient.pets.forEach((pet) => {
        nextPetDrafts[pet.id] = pet.internalNotes ?? "";
      });
      setPetNotesDraft(nextPetDrafts);
      setPetNotesStatus({});
      setPetNotesSaving({});
    } else {
      setClientNotesDraft("");
      setPetNotesDraft({});
      setPetNotesStatus({});
      setPetNotesSaving({});
    }
  }, [selectedClient]);

  // Handlers
  const handleCreateClient = useCallback(
    async (data: ClientFormData) => {
      try {
        const discount = Math.min(100, Math.max(0, Number(data.loyaltyDiscountPercent) || 0));
        const normalizedEmail = data.email.trim();
        const normalizedPhone = data.phone.trim();
        const cleanedData = {
          ...data,
          email: normalizedEmail.length > 0 ? normalizedEmail : null,
          phone: normalizedPhone.length > 0 ? normalizedPhone : null,
          address: data.address?.trim() || null,
          emergencyContact: data.emergencyContact?.trim() || null,
          internalNotes: data.internalNotes?.trim() || null,
          loyaltyDiscountPercent: discount,
        };

        const res = await authFetch("/api/admin/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage =
            errorData.message || errorData.title || t("admin:clients.failedToCreate");
          throw new Error(errorMessage);
        }

        onRefresh();
        setShowCreateModal(false);
      } catch (err: unknown) {
        throw Object.assign(new Error((err as Error).message || t("admin:clients.errorCreating")), {
          cause: err,
        });
      }
    },
    [authFetch, onRefresh, t]
  );

  const handleUpdateClient = useCallback(
    async (data: ClientFormData) => {
      if (!editClientSnapshot) return;
      try {
        const discount = Math.min(100, Math.max(0, Number(data.loyaltyDiscountPercent) || 0));
        const normalizedPhone = data.phone.trim();
        const cleanedData = {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: normalizedPhone.length > 0 ? normalizedPhone : null,
          address: data.address?.trim() || null,
          emergencyContact: data.emergencyContact?.trim() || null,
          internalNotes: data.internalNotes?.trim() || null,
          loyaltyDiscountPercent: discount,
        };

        const res = await authFetch(`/api/admin/clients/${editClientSnapshot.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage =
            errorData.message || errorData.title || t("admin:clients.failedToUpdate");
          throw new Error(errorMessage);
        }

        // Invalidate cache for clients
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              key[0].includes("/api/admin/clients")
            );
          },
        });

        onRefresh();
        setSelectedClientId(editClientSnapshot.id);
        setShowEditModal(false);
        setEditClientSnapshot(null);
        showSuccessMessage(t("admin:clients.clientUpdated"));
      } catch (err: unknown) {
        throw Object.assign(new Error((err as Error).message || t("admin:clients.errorUpdating")), {
          cause: err,
        });
      }
    },
    [authFetch, editClientSnapshot, onRefresh, queryClient, showSuccessMessage, t]
  );

  const handleOpenEditModal = useCallback(() => {
    if (!selectedClient) return;
    setEditClientSnapshot(selectedClient);
    setShowEditModal(true);
  }, [selectedClient]);

  const editClientInitialData = useMemo(
    () => ({
      firstName: editClientSnapshot?.firstName || "",
      lastName: editClientSnapshot?.lastName || "",
      email: editClientSnapshot?.email || "",
      phone: editClientSnapshot?.phone || "",
      address: editClientSnapshot?.address || "",
      emergencyContact: "", // Add field if available in backend
      internalNotes: editClientSnapshot?.internalNotes || "",
      loyaltyDiscountPercent: editClientSnapshot?.loyaltyDiscountPercent || 0,
    }),
    [editClientSnapshot]
  );

  const handleDeleteClient = useCallback(async () => {
    if (!selectedClient) return;
    try {
      const res = await authFetch(`/api/admin/clients/${selectedClient.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t("admin:clients.failedToDelete"));
      onRefresh();
      setShowDeleteConfirm(false);
      setSelectedClientId(null);
    } catch {
      setAlertModal({
        isOpen: true,
        message: t("admin:clients.errorDeleting"),
        type: "error",
      });
    }
  }, [authFetch, selectedClient, onRefresh, t]);

  const handleDeletePet = useCallback(
    async (petId: string) => {
      try {
        const res = await authFetch(`/api/pets/${petId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(t("admin:pets.failedToDelete"));
        onRefresh();
        setPetToDelete(null);
      } catch {
        setAlertModal({
          isOpen: true,
          message: t("admin:pets.errorDeleting"),
          type: "error",
        });
      }
    },
    [authFetch, onRefresh, t]
  );

  const handleCreatePet = useCallback(
    async (data: PetFormData) => {
      if (!selectedClient) return;
      try {
        const cleanedData = {
          name: data.name,
          species: Number(data.species),
          gender: Number(data.gender),
          breed: data.breed?.trim() || null,
          birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : null,
          weight: data.weight || null,
          color: data.color?.trim() || null,
          microchip: data.microchip?.trim() || null,
          specialNeeds: data.specialNeeds?.trim() || null,
          internalNotes: data.internalNotes?.trim() || null,
        };

        const res = await authFetch(`/api/admin/clients/${selectedClient.id}/pets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage =
            errorData.message || errorData.title || t("admin:pets.failedToCreate");
          throw new Error(errorMessage);
        }

        onRefresh();
        setShowAddPetModal(false);
        setActiveTab("pets");
        showSuccessMessage(t("admin:pets.petAdded"));
      } catch (err: unknown) {
        throw Object.assign(new Error((err as Error).message || t("admin:pets.errorCreating")), {
          cause: err,
        });
      }
    },
    [authFetch, selectedClient, onRefresh, showSuccessMessage, t]
  );

  const handleUpdatePet = useCallback(
    async (data: PetFormData) => {
      if (!selectedClient) return;
      if (!petToEdit) throw new Error(t("admin:pets.failedToUpdate"));
      try {
        const cleanedData = {
          name: data.name,
          species: Number(data.species),
          gender: Number(data.gender),
          breed: data.breed?.trim() || null,
          birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : null,
          weight: data.weight || null,
          color: data.color?.trim() || null,
          microchip: data.microchip?.trim() || null,
          specialNeeds: data.specialNeeds?.trim() || null,
          internalNotes: data.internalNotes?.trim() || null,
        };

        const res = await authFetch(
          `/api/admin/clients/${selectedClient.id}/pets/${petToEdit.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cleanedData),
          }
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage =
            errorData.message || errorData.title || t("admin:pets.failedToUpdate");
          throw new Error(errorMessage);
        }

        // Invalidate cache for clients
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              key[0].includes("/api/admin/clients")
            );
          },
        });

        onRefresh();
        setShowAddPetModal(false);
        setPetToEdit(null);
        setActiveTab("pets");
        showSuccessMessage(t("admin:pets.petUpdated"));
      } catch (err: unknown) {
        throw Object.assign(new Error((err as Error).message || t("admin:pets.errorUpdating")), {
          cause: err,
        });
      }
    },
    [authFetch, selectedClient, petToEdit, onRefresh, queryClient, showSuccessMessage, t]
  );

  const handleSaveClientNotes = useCallback(async () => {
    if (!selectedClient) return;
    setClientNotesSaving(true);
    setClientNotesStatus(null);
    try {
      const payload = {
        notes: clientNotesDraft.trim() ? clientNotesDraft.trim() : null,
      };
      const res = await authFetch(`/api/admin/clients/${selectedClient.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.title || t("admin:notes.failedToSave");
        throw new Error(errorMessage);
      }
      // Invalidate cache for clients
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            typeof key[0] === "string" &&
            key[0].includes("/api/admin/clients")
          );
        },
      });
      setClientNotesStatus(t("admin:notes.saved"));
      onRefresh();
      setTimeout(() => setClientNotesStatus(null), 2500);
    } catch (err: unknown) {
      setClientNotesStatus((err as Error).message || t("admin:notes.error"));
    } finally {
      setClientNotesSaving(false);
    }
  }, [authFetch, selectedClient, clientNotesDraft, onRefresh, queryClient, t]);

  const handleSavePetNotes = useCallback(
    async (petId: string) => {
      if (!selectedClient) return;
      setPetNotesSaving((prev) => ({ ...prev, [petId]: true }));
      setPetNotesStatus((prev) => ({ ...prev, [petId]: null }));
      try {
        const payload = {
          notes: petNotesDraft[petId]?.trim() ? petNotesDraft[petId].trim() : null,
        };
        const res = await authFetch(`/api/admin/clients/${selectedClient.id}/pets/${petId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage =
            errorData.message || errorData.title || t("admin:notes.failedToSave");
          throw new Error(errorMessage);
        }
        // Invalidate cache for clients
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              key[0].includes("/api/admin/clients")
            );
          },
        });
        setPetNotesStatus((prev) => ({ ...prev, [petId]: t("admin:notes.saved") }));
        onRefresh();
        setTimeout(() => setPetNotesStatus((prev) => ({ ...prev, [petId]: null })), 2500);
      } catch (err: unknown) {
        setPetNotesStatus((prev) => ({
          ...prev,
          [petId]: (err as Error).message || t("admin:notes.error"),
        }));
      } finally {
        setPetNotesSaving((prev) => ({ ...prev, [petId]: false }));
      }
    },
    [authFetch, selectedClient, petNotesDraft, onRefresh, queryClient, t]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 lg:gap-6 min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)]">
      {/* Left Panel: Client List */}
      <div className="w-full lg:w-auto flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:h-[calc(100vh-8rem)] lg:sticky lg:top-4 min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-lg font-bold text-slate-900">{t("admin:clients.title")}</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm"
              title={t("admin:clients.addClient")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
          </div>
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin:clients.searchPlaceholder")}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {loading && filteredClients.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 animate-pulse">
              {t("admin:clients.loading")}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {t("admin:clients.notFound")}
            </div>
          ) : (
            filteredClients.map((client) => {
              const isActive = client.id === selectedClientId;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3 ${
                    isActive
                      ? "bg-brand text-white shadow-md shadow-brand/20"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {client.firstName[0]}
                    {client.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`font-semibold truncate ${isActive ? "text-white" : "text-slate-900"}`}
                      >
                        {client.fullName}
                      </p>
                      {client.pets.length > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {client.pets.length} 🐾
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${isActive ? "text-white/80" : "text-slate-500"}`}
                    >
                      {client.email}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Details */}
      <div className="flex-1 flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[380px]">
        {selectedClient ? (
          <>
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/30 sticky top-0 z-10">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-brand/20">
                    {selectedClient.firstName[0]}
                    {selectedClient.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h1 className="text-2xl font-bold text-slate-900 truncate">
                        {selectedClient.fullName}
                      </h1>
                      <div className="hidden sm:flex gap-2 flex-shrink-0">
                        <button
                          onClick={handleOpenEditModal}
                          className="p-2 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                          title={t("admin:clients.edit")}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={t("admin:clients.delete")}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        {selectedClient.phone}
                      </span>
                      <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="truncate">{selectedClient.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex sm:hidden gap-2 flex-shrink-0 justify-end">
                  <button
                    onClick={handleOpenEditModal}
                    className="p-2 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                    title={t("admin:clients.edit")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title={t("admin:clients.delete")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-4 sm:px-6 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "profile"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("admin:clients.profile")}
              </button>
              <button
                onClick={() => setActiveTab("pets")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "pets"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("admin:pets.title")}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === "pets" ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {selectedClient.pets.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "notes"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("admin:clients.notes")}
              </button>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="mx-4 sm:mx-6 mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-emerald-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {successMessage}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === "profile" && (
                <div className="space-y-6 max-w-3xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {t("admin:clients.phoneLabel")}
                      </p>
                      <p className="font-medium text-slate-900">{selectedClient.phone}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {t("admin:clients.email")}
                      </p>
                      <p className="font-medium text-slate-900">{selectedClient.email}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {t("admin:clients.addressLabel")}
                      </p>
                      <p className="font-medium text-slate-900">{selectedClient.address || "—"}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {t("admin:clients.discountLabel")}
                      </p>
                      <p className="font-medium text-brand">
                        {(selectedClient.loyaltyDiscountPercent ?? 0).toLocaleString()}%
                      </p>
                    </div>
                  </div>

                  {selectedClient.internalNotes && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
                        {t("admin:clients.importantNote")}
                      </p>
                      <p className="text-sm text-amber-900">{selectedClient.internalNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "pets" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setPetToEdit(null);
                        setShowAddPetModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors shadow-sm"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      {t("admin:pets.addPet")}
                    </button>
                  </div>

                  {selectedClient.pets.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                      <p className="text-slate-500">{t("admin:clients.noPets")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {selectedClient.pets.map((pet) => {
                        const noteValue = petNotesDraft[pet.id] ?? "";
                        const hasChanges = noteValue !== (pet.internalNotes ?? "");
                        const saving = petNotesSaving[pet.id];
                        const status = petNotesStatus[pet.id];

                        return (
                          <div
                            key={pet.id}
                            className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-bold text-slate-900">{pet.name}</h3>
                                  <p className="text-xs text-slate-500">
                                    {getSpeciesLabel(pet.species)} •{" "}
                                    {getGenderLabel(pet.gender, pet.species)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setPetToEdit(pet);
                                    setShowAddPetModal(true);
                                  }}
                                  className="text-slate-400 hover:text-brand p-1"
                                  title={t("admin:pets.editPet")}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setPetToDelete(pet.id)}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                  title={t("admin:pets.deletePet")}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {pet.breed && (
                                  <span className="px-2 py-1 rounded-md bg-slate-100 text-xs text-slate-600">
                                    {pet.breed}
                                  </span>
                                )}
                                {pet.ageYears != null && (
                                  <span className="px-2 py-1 rounded-md bg-slate-100 text-xs text-slate-600">
                                    {pet.ageYears} {t("admin:clients.years")}
                                  </span>
                                )}
                                {pet.weight && (
                                  <span className="px-2 py-1 rounded-md bg-slate-100 text-xs text-slate-600">
                                    {pet.weight} {t("admin:clients.kg")}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3">
                                <textarea
                                  value={noteValue}
                                  onChange={(e) => {
                                    setPetNotesDraft((prev) => ({
                                      ...prev,
                                      [pet.id]: e.target.value,
                                    }));
                                    setPetNotesStatus((prev) => ({ ...prev, [pet.id]: null }));
                                  }}
                                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand focus:outline-none transition-colors"
                                  rows={2}
                                  placeholder={t("admin:clients.petNotesPlaceholder")}
                                />
                                {hasChanges && (
                                  <div className="mt-1 flex justify-end">
                                    <button
                                      onClick={() => handleSavePetNotes(pet.id)}
                                      disabled={saving}
                                      className="text-xs font-medium text-brand hover:text-brand-dark"
                                    >
                                      {saving ? t("admin:notes.saving") : t("admin:notes.saveNote")}
                                    </button>
                                  </div>
                                )}
                                {status && (
                                  <p className="text-[10px] text-emerald-600 text-right mt-1">
                                    {status}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 relative">
                    <textarea
                      value={clientNotesDraft}
                      onChange={(e) => {
                        setClientNotesDraft(e.target.value);
                        setClientNotesStatus(null);
                      }}
                      className="w-full h-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand focus:outline-none resize-none transition-colors"
                      placeholder={t("admin:clients.internalNotes")}
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-3">
                      {clientNotesStatus && (
                        <span
                          className={`text-sm ${clientNotesStatus === t("admin:notes.saved") ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {clientNotesStatus}
                        </span>
                      )}
                      <button
                        onClick={handleSaveClientNotes}
                        disabled={clientNotesSaving || !clientNotesChanged}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          clientNotesSaving || !clientNotesChanged
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/20"
                        }`}
                      >
                        {clientNotesSaving ? t("admin:notes.saving") : t("admin:notes.save")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <svg
              className="w-16 h-16 mb-4 text-slate-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p>{t("admin:clients.selectClient")}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClientFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateClient}
        mode="create"
      />

      <ClientFormModal
        isOpen={showEditModal && !!editClientSnapshot}
        onClose={() => {
          setShowEditModal(false);
          setEditClientSnapshot(null);
        }}
        onSubmit={handleUpdateClient}
        initialData={editClientInitialData}
        mode="edit"
      />

      {selectedClient && (
        <PetFormModal
          isOpen={showAddPetModal}
          onClose={() => {
            setShowAddPetModal(false);
            setPetToEdit(null);
          }}
          onSubmit={petToEdit ? handleUpdatePet : handleCreatePet}
          clientName={selectedClient.fullName}
          initialData={
            petToEdit
              ? {
                  id: petToEdit.id,
                  name: petToEdit.name,
                  species: petToEdit.species,
                  gender: petToEdit.gender,
                  breed: petToEdit.breed || "",
                  birthDate: petToEdit.birthDate
                    ? new Date(petToEdit.birthDate).toISOString().split("T")[0]
                    : "",
                  weight: petToEdit.weight || undefined,
                  color: petToEdit.color || "",
                  microchip: petToEdit.microchip || "",
                  specialNeeds: petToEdit.specialNeeds || "",
                  internalNotes: petToEdit.internalNotes || "",
                }
              : undefined
          }
          mode={petToEdit ? "edit" : "create"}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t("admin:clients.deleteClient")}</h3>
            <p className="mt-2 text-slate-600">
              {t("admin:clients.deleteClientConfirm1")} <strong>{selectedClient?.fullName}</strong>?{" "}
              {t("admin:clients.deleteClientConfirm2")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("admin:clients.cancel")}
              </button>
              <button
                onClick={handleDeleteClient}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                {t("admin:clients.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pet Confirmation */}
      {petToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t("admin:pets.deletePet")}?</h3>
            <p className="mt-2 text-slate-600">{t("admin:pets.deletePetConfirm")}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPetToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("admin:clients.cancel")}
              </button>
              <button
                onClick={() => handleDeletePet(petToDelete)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                {t("admin:clients.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, message: "" })}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

export default AdminClientsPanel;
