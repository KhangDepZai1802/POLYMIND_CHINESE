import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeacherB2CClassCards } from "@/features/b2c/components/teacher-class-cards";

describe("Assigned B2C teacher classes", () => {
  it("opens the B2C detail route and shows roster count and schedule", () => {
    render(
      <TeacherB2CClassCards
        classes={[
          {
            id: "class-b2c",
            code: "B2C-000002",
            name: "Pre-Movers",
            program_slug: "tieng-anh",
            status: "active",
            capacity: 15,
            weekdays_text: "T3-T5",
            time_text: "17h30–19h00",
            campus: null,
            start_date: null,
            student_count: 5,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Pre-Movers/ })).toHaveAttribute(
      "href",
      "/teacher/b2c-classes/class-b2c",
    );
    expect(screen.getByText("5 học viên")).toBeInTheDocument();
    expect(screen.getByText("T3-T5 · 17h30–19h00")).toBeInTheDocument();
  });
  it("does not render an empty B2C section for unassigned teachers", () => {
    render(<TeacherB2CClassCards classes={[]} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
