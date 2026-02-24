import { FormEvent, useMemo, useState } from "react";
import { FunnelIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import ConfirmModal from "../ConfirmModal";

export type AdminRoom = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor?: number | null;
  specialNotes?: string | null;
  isActive: boolean;
};

type RoomType = {
  id: string;
  name: string;
};

type CreateOrUpdateRoomPayload = {
  roomNumber: string;
  roomTypeId: string;
  floor?: number | null;
  specialNotes?: string | null;
};

type AdminRoomsManagerProps = {
  rooms: AdminRoom[];
  roomTypes: RoomType[];
  loading: boolean;
  error?: string | null;
  onCreate: (payload: CreateOrUpdateRoomPayload) => Promise<string>;
  onUpdate: (roomId: string, payload: CreateOrUpdateRoomPayload) => Promise<void>;
  onDelete: (roomId: string) => Promise<void>;
};

type RoomFormState = {
  roomNumber: string;
  roomTypeId: string;
  floor: string;
  specialNotes: string;
};

const initialFormState: RoomFormState = {
  roomNumber: "",
  roomTypeId: "",
  floor: "",
  specialNotes: "",
};

const toFormState = (room: AdminRoom): RoomFormState => ({
  roomNumber: room.roomNumber ?? "",
  roomTypeId: room.roomTypeId ?? "",
  floor: room.floor != null ? String(room.floor) : "",
  specialNotes: room.specialNotes ?? "",
});

const AdminRoomsManager = ({
  rooms,
  roomTypes,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: AdminRoomsManagerProps) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<RoomFormState>(initialFormState);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminRoom | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "ru-RU")),
    [rooms]
  );
  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedRooms.filter((room) => {
      if (!showInactive && !room.isActive) return false;
      if (typeFilter !== "all" && room.roomTypeId !== typeFilter) return false;
      if (!term) return true;
      return (
        room.roomNumber.toLowerCase().includes(term) ||
        room.roomTypeName.toLowerCase().includes(term) ||
        (room.specialNotes ?? "").toLowerCase().includes(term)
      );
    });
  }, [sortedRooms, search, typeFilter, showInactive]);

  const typeStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rt of roomTypes) map[rt.id] = 0;
    for (const r of sortedRooms) {
      if (!r.isActive && !showInactive) continue;
      map[r.roomTypeId] = (map[r.roomTypeId] ?? 0) + 1;
    }
    return map;
  }, [roomTypes, sortedRooms, showInactive]);

  const resetForm = () => {
    setActiveRoomId(null);
    setFormState(initialFormState);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFormOpen(true);
  };

  const updateField = <K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = (): CreateOrUpdateRoomPayload | null => {
    const roomNumber = formState.roomNumber.trim();
    const roomTypeId = formState.roomTypeId;
    const floor = formState.floor.trim() === "" ? null : Number(formState.floor);

    if (!roomNumber) {
      setFormError(t("admin:rooms.validation.roomNumberRequired"));
      return null;
    }

    if (!roomTypeId) {
      setFormError(t("admin:rooms.validation.roomTypeRequired"));
      return null;
    }

    if (floor != null && (!Number.isFinite(floor) || floor < 0)) {
      setFormError(t("admin:rooms.validation.floorNonNegative"));
      return null;
    }

    return {
      roomNumber,
      roomTypeId,
      floor,
      specialNotes: formState.specialNotes.trim() || null,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setSubmitting(true);
    try {
      if (activeRoomId) {
        await onUpdate(activeRoomId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
      setFormOpen(false);
    } catch (submitError) {
      setFormError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (room: AdminRoom) => {
    setActiveRoomId(room.id);
    setFormState(toFormState(room));
    setFormError(null);
    setFormOpen(true);
  };

  const handleDeleteConfirmed = async (room: AdminRoom) => {
    setDeletingId(room.id);
    try {
      await onDelete(room.id);
      if (room.id === activeRoomId) {
        resetForm();
      }
    } catch (deleteError) {
      setFormError((deleteError as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = Boolean(activeRoomId);

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm">
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {t("admin:rooms.manageTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t("admin:rooms.manageSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="rounded-xl sm:rounded-2xl bg-slate-50 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">
            {t("admin:rooms.roomCount", { count: rooms.length })}
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-full bg-brand px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-white transition hover:bg-brand-dark whitespace-nowrap"
          >
            {t("admin:rooms.addRoom")}
          </button>
        </div>
      </div>

      {(error || formError) && (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {formError ?? error}
        </div>
      )}

      <div className="mt-6 sm:mt-8">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                {t("admin:rooms.roomList")}
              </h3>
              {loading && (
                <span className="text-xs font-semibold uppercase text-slate-400">
                  {t("admin:rooms.updating")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {roomTypes.slice(0, 3).map((rt) => (
                <span
                  key={rt.id}
                  className="rounded-full bg-slate-50 border border-slate-200 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-600"
                >
                  {rt.name}: {typeStats[rt.id] ?? 0}
                </span>
              ))}
              <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-600">
                {t("admin:rooms.total", {
                  filtered: filteredRooms.length,
                  total: sortedRooms.length,
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
              <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin:rooms.searchPlaceholder")}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs font-semibold text-brand hover:text-brand-dark flex-shrink-0"
                >
                  {t("admin:rooms.clear")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3 py-2 shadow-sm">
                <FunnelIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm outline-none text-slate-800 min-w-0 flex-1"
                >
                  <option value="all">{t("admin:rooms.allTypes")}</option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-slate-700 shadow-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="hidden sm:inline">{t("admin:rooms.showArchived")}</span>
                <span className="sm:hidden">{t("admin:rooms.archivedShort")}</span>
              </label>
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-white px-4 sm:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-slate-500">
              {t("admin:rooms.noRooms")}{" "}
              {sortedRooms.length === 0
                ? t("admin:rooms.addFirstRoom")
                : t("admin:rooms.resetFilters")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  className={`grid grid-cols-12 gap-2 sm:gap-3 items-center rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5 transition hover:shadow-sm ${room.isActive ? "border-slate-100 bg-white" : "border-slate-200 bg-slate-50/80"
                    }`}
                >
                  {/* Room number - 2 cols */}
                  <span className="col-span-2 text-sm font-bold text-slate-900 truncate">
                    {t("admin:rooms.roomLabel", { number: room.roomNumber })}
                  </span>

                  {/* Room type - 3 cols */}
                  <span className="col-span-3 text-xs sm:text-sm text-brand font-semibold truncate">
                    {room.roomTypeName}
                  </span>

                  {/* Floor - 2 cols (hidden on mobile) */}
                  {room.floor != null ? (
                    <span className="hidden sm:inline-flex col-span-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 truncate justify-center">
                      {t("admin:rooms.floorLabel", { floor: room.floor })}
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex col-span-2" />
                  )}

                  {/* Notes - 2 cols (hidden on lg) */}
                  <span className="hidden lg:block col-span-2 text-xs text-slate-400 truncate">
                    {room.specialNotes || "—"}
                  </span>

                  {/* Status badge - 2 cols on mobile, 1 col on sm+ */}
                  <span
                    className={`col-span-2 sm:col-span-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-center ${room.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                      }`}
                  >
                    {room.isActive ? t("admin:rooms.active") : t("admin:rooms.inactive")}
                  </span>

                  {/* Actions - 3 cols on mobile, 2 cols on sm+ */}
                  <div className="col-span-3 sm:col-span-2 flex items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(room)}
                      className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand truncate"
                    >
                      {t("admin:rooms.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(room)}
                      disabled={deletingId === room.id}
                      className="flex-1 rounded-md border border-rose-200 px-2 py-1 text-[10px] sm:text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 truncate"
                    >
                      {deletingId === room.id ? t("admin:rooms.deleting") : t("admin:rooms.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for create/edit room */}
      {formOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
          <div className="relative w-full max-w-[600px] rounded-2xl sm:rounded-3xl bg-white p-0 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between bg-gradient-to-r from-brand/10 to-transparent px-4 sm:px-5 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {isEditing ? t("admin:rooms.editTitle") : t("admin:rooms.addTitle")}
              </h3>
              <button
                type="button"
                className="text-slate-400 transition hover:text-slate-600 flex-shrink-0"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                aria-label={t("admin:rooms.closeLabel")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-5">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:gap-4 text-xs sm:text-sm"
              >
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">
                    {t("admin:rooms.roomNumberLabel")}
                  </span>
                  <input
                    type="text"
                    value={formState.roomNumber}
                    onChange={(event) => updateField("roomNumber", event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
                    placeholder={t("admin:rooms.roomNumberPlaceholder")}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">
                    {t("admin:rooms.roomTypeLabel")}
                  </span>
                  <select
                    value={formState.roomTypeId}
                    onChange={(event) => updateField("roomTypeId", event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
                    required
                  >
                    <option value="">{t("admin:rooms.selectRoomType")}</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">{t("admin:rooms.floorLabel2")}</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.floor}
                    onChange={(event) => updateField("floor", event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
                    placeholder={t("admin:rooms.floorPlaceholder")}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">{t("admin:rooms.notesLabel")}</span>
                  <textarea
                    value={formState.specialNotes}
                    onChange={(event) => updateField("specialNotes", event.target.value)}
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
                    placeholder={t("admin:rooms.notesPlaceholder")}
                  />
                </label>

                <div className="mt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormOpen(false);
                      resetForm();
                    }}
                    className="w-full sm:w-auto rounded-full border border-slate-200 px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                  >
                    {t("admin:rooms.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto rounded-full bg-brand px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
                  >
                    {submitting
                      ? t("admin:rooms.saving")
                      : isEditing
                        ? t("admin:rooms.saveChanges")
                        : t("admin:rooms.addButton")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) handleDeleteConfirmed(confirmDelete);
        }}
        message={
          confirmDelete
            ? t("admin:rooms.deleteConfirm", {
              roomType: confirmDelete.roomTypeName,
              roomNumber: confirmDelete.roomNumber,
            })
            : ""
        }
        type="danger"
        zIndex={350}
      />
    </section>
  );
};

export default AdminRoomsManager;
