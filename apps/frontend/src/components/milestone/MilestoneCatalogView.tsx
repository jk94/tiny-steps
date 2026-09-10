import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import type { MilestoneSummary } from '../../api/milestone-api';
import { canWrite, ENTRY_WRITE_ROLES, type HouseholdRole } from '../../lib/householdPermissions';
import { groupTemplatesByAgeBucket, milestoneTemplateLabelKey } from '../../lib/milestoneCatalog';
import { milestoneCategoryVisuals } from '../../lib/milestoneCategoryVisuals';
import { Badge, Card } from '../ui';

export interface MilestoneCatalogViewProps {
  householdId: string;
  childId: string;
  /** The child's recorded milestones, used to mark templates as done (M-5). */
  milestones: MilestoneSummary[];
  /**
   * The signed-in user's role in this household. Gates only the "record this
   * one" tap-through on an *unrecorded* template — browsing the catalog and
   * opening an already-recorded entry stay open to every role.
   */
  role: HouseholdRole | undefined;
}

/**
 * The "what's next?" view (M-12): the template catalog grouped by typical age,
 * with the already-recorded entries marked.
 *
 * Deliberately **not** a progress or assessment view. Nothing is labelled
 * overdue, there is no completion count and no percentage — the age spans are
 * phrased as "usually between X and Y months" precisely because a child who
 * has not reached one is not behind. The only state a tile carries is "already
 * recorded", which exists so tapping it opens the existing entry instead of
 * running into the uniqueness rule (M-5).
 */
export function MilestoneCatalogView({
  householdId,
  childId,
  milestones,
  role,
}: MilestoneCatalogViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const mayRecord = canWrite(role, ENTRY_WRITE_ROLES);
  const basePath = `/households/${householdId}/children/${childId}/milestones`;
  // Template key -> the milestone recording it. At most one per key, enforced
  // by the DB's unique index.
  const recordedByTemplate = new Map(
    milestones
      .filter((milestone) => milestone.templateKey !== null)
      .map((milestone) => [milestone.templateKey as string, milestone]),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('milestone.catalog.intro')}</p>

      {groupTemplatesByAgeBucket().map(({ bucket, templates }) => (
        <section key={`${bucket.minMonths}-${bucket.maxMonths}`} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t('milestone.catalog.ageGroupLabel', {
              min: bucket.minMonths,
              max: bucket.maxMonths,
            })}
          </h3>

          <ul className="flex flex-col gap-2">
            {templates.map((template) => {
              const recorded = recordedByTemplate.get(template.key);
              const label = t(milestoneTemplateLabelKey(template.key));
              const visual = milestoneCategoryVisuals[template.category];
              // Tapping an unrecorded template opens the create form, so it is
              // a create affordance and gated. An already-recorded one merely
              // opens the existing entry — that's reading, open to every role.
              const isTappable = recorded !== undefined || mayRecord;
              const tileContent = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('milestone.catalog.typicalRange', {
                        min: template.typicalAgeMonths[0],
                        max: template.typicalAgeMonths[1],
                      })}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    <visual.Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      style={{ color: `var(${visual.colorVar})` }}
                    />
                    <Badge variant={visual.badgeVariant} size="sm">
                      {t(visual.labelKey)}
                    </Badge>
                  </span>

                  {recorded && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                      <Check aria-hidden="true" className="h-4 w-4" />
                      {t('milestone.catalog.achievedMarker')}
                    </span>
                  )}
                </>
              );
              const tileClassName = 'flex w-full items-center gap-3 rounded-lg p-3 text-left';

              return (
                <li key={template.key}>
                  <Card>
                    <Card.Body className="p-0">
                      {isTappable ? (
                        <button
                          type="button"
                          className={`${tileClassName} transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
                          aria-label={
                            recorded
                              ? t('milestone.catalog.openAchieved', { title: label })
                              : t('milestone.catalog.recordTemplate', { title: label })
                          }
                          onClick={() =>
                            // Already recorded -> open it, rather than let the
                            // user run into the 409 (M-5).
                            void navigate(
                              recorded
                                ? `${basePath}/${recorded.id}/edit`
                                : `${basePath}/new?templateKey=${template.key}`,
                            )
                          }
                        >
                          {tileContent}
                        </button>
                      ) : (
                        // Read-only role, template not yet recorded: the entry
                        // stays browsable, just not tappable.
                        <div className={tileClassName}>{tileContent}</div>
                      )}
                    </Card.Body>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
