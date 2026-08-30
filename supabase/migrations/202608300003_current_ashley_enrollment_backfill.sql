-- Correct the current Ashley enrollment projection for the roster's exact
-- grade labels. The earlier additive migration intentionally inserted no row
-- when its simplified grade mapping did not match production.
-- provenance: active 2026-27 private roster projection; grades 9-12 in this
-- Ashley High School band program are current Ashley High enrollments.

insert into portal_student_enrollments (
  student_id, school_id, school_year, grade, source, source_reference
)
select
  student.id,
  school.id,
  '2026-27',
  student.grade_fall26,
  'bdos_csv_projection',
  'active AshleyBands roster; grade_fall26 is 9th-12th Grade'
from portal_students student
cross join portal_schools school
where school.code = 'ashley-high'
  and lower(coalesce(student.status, '')) = 'active'
  and student.grade_fall26 in ('9th Grade', '10th Grade', '11th Grade', '12th Grade')
  and not exists (
    select 1 from portal_student_enrollments enrollment
    where enrollment.student_id = student.id and enrollment.ends_on is null
  );
