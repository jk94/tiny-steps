import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { deleteChild, fetchChild, updateChild } from '../api/child-api';
import { ChildForm } from '../components/ChildForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { bumpPhotoCacheBust } from '../child/childPhotoCacheBust';
import { mapChildError } from '../child/mapChildError';
import { mapHouseholdError } from '../household/mapHouseholdError';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function ChildEdit() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const householdQuery = useQuery({
    queryKey: ['households', householdId],
    queryFn: () => fetchHousehold(householdId!),
    retry: false,
    enabled: !!householdId,
  });

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChild(householdId!, childId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['households', householdId, 'children'] });
      navigate(`/households/${householdId}`, { replace: true });
    },
  });

  if (householdQuery.isLoading || childQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (householdQuery.error || !householdQuery.data) {
    return <ErrorMessage message={t(mapHouseholdError(householdQuery.error))} />;
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const household = householdQuery.data;
  const child = childQuery.data;

  const handleSubmit = async (formData: FormData) => {
    await updateChild(household.id, child.id, formData);
    // No photo-version field exists server-side, so a successful update
    // that included a new photo bumps the client-side cache-bust counter
    // (see `child/childPhotoCacheBust.ts`) so `<ChildPhoto>` re-fetches
    // instead of serving the browser's cached image.
    if (formData.has('photo')) {
      bumpPhotoCacheBust(child.id);
    }
    await queryClient.invalidateQueries({ queryKey: ['households', household.id, 'children'] });
    navigate(`/households/${household.id}`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${household.id}`}>{household.name}</Link>
      <h1>{t('child.edit.title')}</h1>
      <ChildForm
        mode="edit"
        initialValues={{
          name: child.name,
          // `birthDate` arrives as a full ISO8601 datetime string; an
          // `<input type="date">` value must be the date-only portion.
          birthDate: child.birthDate.slice(0, 10),
          childId: child.id,
          householdId: household.id,
          hasPhoto: child.hasPhoto,
        }}
        onSubmit={handleSubmit}
      />

      {/* Child deletion is OWNER-only server-side (see `ChildController`) —
          completely hidden for a CO_PARENT, not just disabled. */}
      {household.role === 'OWNER' && (
        <>
          <button type="button" onClick={() => setIsDeleteDialogOpen(true)}>
            {t('child.edit.deleteButton')}
          </button>
          <ConfirmDialog
            isOpen={isDeleteDialogOpen}
            title={t('child.edit.deleteDialog.title')}
            description={t('child.edit.deleteDialog.description')}
            confirmLabel={t('child.edit.deleteDialog.confirmButton')}
            cancelLabel={t('child.edit.deleteDialog.cancelButton')}
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setIsDeleteDialogOpen(false)}
            isConfirming={deleteMutation.isPending}
          />
          {deleteMutation.isError && (
            <ErrorMessage message={t(mapChildError(deleteMutation.error))} />
          )}
        </>
      )}
    </section>
  );
}
