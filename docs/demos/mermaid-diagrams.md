# Mermaid Diagram Test Suite

[← Back to Demos](/?url=docs/demos/index.md) | [Welcome](/?sample)

---

A comprehensive test page covering all Mermaid diagram types and edge cases. Use this for regression testing after renderer changes.

## Quick Navigation

- [Flowcharts](#flowcharts)
- [Sequence Diagrams](#sequence-diagrams)
- [Class Diagrams](#class-diagrams)
- [State Diagrams](#state-diagrams)
- [Entity Relationship](#entity-relationship-diagrams)
- [User Journey](#user-journey)
- [Gantt Charts](#gantt-charts)
- [Pie Charts](#pie-charts)
- [Quadrant Charts](#quadrant-chart)
- [Git Graph](#git-graph)
- [Mindmaps](#mindmaps)
- [Timeline](#timeline)
- [Sankey](#sankey-diagram)
- [XY Charts](#xy-chart)
- [Block Diagrams](#block-diagrams)
- [Edge Cases](#edge-cases)
- [Accessibility](#accessibility)
- [Browser Compatibility](#browser-compatibility)

---

## Flowcharts

### Basic Flowchart (LR)

```mermaid
graph LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

### Flowchart with Subgraphs

```mermaid
graph TD
    subgraph Frontend
        A[Browser] --> B[React App]
        B --> C[Components]
    end

    subgraph Backend
        D[API Server] --> E[Database]
        D --> F[Cache]
    end

    C --> D
```

### Clickable Flowchart

Click on any node to navigate (uses standard Mermaid `click` directive):

```mermaid
graph LR
    subgraph Navigation Test
        A[Welcome Page]
        B[Sample Content]
        C[Demos Index]
        D[About Merview]
    end

    A --> B
    A --> C
    A --> D

    click A "/?sample" "Go to Welcome"
    click B "/?url=docs/demos/sample.md" "Go to Sample"
    click C "/?url=docs/demos/index.md" "Go to Demos"
    click D "/?url=docs/about.md" "Go to About"
```

> **Note:** Clickable nodes use Mermaid's standard `click` directive syntax. Links may be subject to security filtering by the renderer's sanitization process.

### Edge Labels (Critical for Issue #327)

This tests the foreignObject rendering with edge labels:

```mermaid
graph LR
    A[Source] -->|label text| B[Target]
    B -->|another label| C[End]
    C -->|with special chars: <>&| D[Done]
```

### Complex Edge Labels

```mermaid
graph TD
    A[Start] -->|This is a longer label that wraps| B[Middle]
    B -->|Short| C[End]
    B -->|Multiple words in label| D[Alt End]
```

### All Node Shapes

```mermaid
graph TD
    A[Rectangle] --> B(Rounded)
    B --> C([Stadium])
    C --> D[[Subroutine]]
    D --> E[(Database)]
    E --> F((Circle))
    F --> G>Asymmetric]
    G --> H{Diamond}
    H --> I{{Hexagon}}
    I --> J[/Parallelogram/]
    J --> K[\Parallelogram Alt\]
    K --> L[/Trapezoid\]
    L --> M[\Trapezoid Alt/]
```

### Styled Flowchart

```mermaid
graph LR
    A[Start]:::green --> B[Process]:::blue
    B --> C[End]:::red

    classDef green fill:#9f6,stroke:#333
    classDef blue fill:#69f,stroke:#333
    classDef red fill:#f66,stroke:#333
```

---

## Sequence Diagrams

### Basic Sequence

```mermaid
sequenceDiagram
    participant User
    participant Server
    participant Database

    User->>Server: Request
    Server->>Database: Query
    Database-->>Server: Results
    Server-->>User: Response
```

### With Activations and Notes

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob

    A->>+B: Hello Bob!
    Note right of B: Bob thinks
    B-->>-A: Hi Alice!

    Note over A,B: They chat for a while

    A->>B: How are you?
    B-->>A: Great, thanks!
```

### Loops and Alt

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    C->>S: Login request

    alt Valid credentials
        S-->>C: Success token
    else Invalid credentials
        S-->>C: Error 401
    end

    loop Every 5 minutes
        C->>S: Heartbeat
        S-->>C: Ack
    end
```

### Complex Sequence with Multiple Features

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database

    U->>F: Click Submit
    activate F
    F->>A: POST /data
    activate A

    Note over A: Validate input

    A->>D: INSERT query
    activate D
    D-->>A: Success
    deactivate D

    A-->>F: 201 Created
    deactivate A

    F-->>U: Show success message
    deactivate F
```

---

## Class Diagrams

### Basic Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }

    class Dog {
        +String breed
        +bark()
        +fetch()
    }

    class Cat {
        +String color
        +meow()
        +scratch()
    }

    Animal <|-- Dog
    Animal <|-- Cat
```

### With Relationships

```mermaid
classDiagram
    class Order {
        +int orderId
        +Date orderDate
        +calculateTotal()
    }

    class Customer {
        +String name
        +String email
        +placeOrder()
    }

    class Product {
        +String name
        +float price
    }

    class LineItem {
        +int quantity
        +getSubtotal()
    }

    Customer "1" --> "*" Order : places
    Order "1" *-- "*" LineItem : contains
    LineItem "*" --> "1" Product : references
```

### Interfaces and Abstract Classes

```mermaid
classDiagram
    class Shape {
        <<abstract>>
        +draw()
        +area()* float
    }

    class Drawable {
        <<interface>>
        +render()
    }

    class Circle {
        +float radius
        +area() float
        +render()
    }

    class Rectangle {
        +float width
        +float height
        +area() float
        +render()
    }

    Shape <|-- Circle
    Shape <|-- Rectangle
    Drawable <|.. Circle
    Drawable <|.. Rectangle
```

---

## State Diagrams

### Basic State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : start
    Processing --> Success : complete
    Processing --> Error : fail
    Success --> [*]
    Error --> Idle : retry
    Error --> [*] : abort
```

### Composite States

```mermaid
stateDiagram-v2
    [*] --> Active

    state Active {
        [*] --> Idle
        Idle --> Running : start
        Running --> Paused : pause
        Paused --> Running : resume
        Running --> Idle : stop
    }

    Active --> Terminated : shutdown
    Terminated --> [*]
```

### With Notes and Forks

```mermaid
stateDiagram-v2
    state fork_state <<fork>>
    state join_state <<join>>

    [*] --> fork_state
    fork_state --> Task1
    fork_state --> Task2
    fork_state --> Task3

    Task1 --> join_state
    Task2 --> join_state
    Task3 --> join_state

    join_state --> Complete
    Complete --> [*]

    note right of Task1 : Parallel execution
```

---

## Entity Relationship Diagrams

### Basic ER Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    CUSTOMER {
        string name
        string email
        int customerId PK
    }
    ORDER {
        int orderId PK
        date orderDate
        int customerId FK
    }
    PRODUCT {
        int productId PK
        string name
        float price
    }
    LINE-ITEM {
        int quantity
        int orderId FK
        int productId FK
    }
```

### Complex ER Diagram

```mermaid
erDiagram
    USER ||--o{ POST : creates
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    POST }o--o{ TAG : tagged_with
    USER ||--o{ FOLLOW : follows
    USER ||--o{ FOLLOW : followed_by

    USER {
        int id PK
        string username UK
        string email UK
        date created_at
    }

    POST {
        int id PK
        string title
        text content
        int author_id FK
        datetime published_at
    }

    COMMENT {
        int id PK
        text body
        int post_id FK
        int user_id FK
    }

    TAG {
        int id PK
        string name UK
    }
```

---

## User Journey

### Basic User Journey

```mermaid
journey
    title User Shopping Experience
    section Browse
      View homepage: 5: User
      Search products: 4: User
      View product details: 5: User
    section Purchase
      Add to cart: 5: User
      Checkout: 3: User
      Enter payment: 2: User, System
      Confirm order: 5: User, System
    section Post-Purchase
      Receive confirmation: 5: System
      Track shipment: 4: User
      Receive product: 5: User
```

---

## Gantt Charts

### Project Timeline

```mermaid
gantt
    title Project Development Schedule
    dateFormat  YYYY-MM-DD

    section Planning
    Requirements gathering    :a1, 2024-01-01, 14d
    Design phase             :a2, after a1, 21d

    section Development
    Frontend development     :b1, after a2, 30d
    Backend development      :b2, after a2, 35d
    Integration              :b3, after b1, 14d

    section Testing
    Unit testing             :c1, after b2, 14d
    Integration testing      :c2, after b3, 10d
    UAT                      :c3, after c2, 7d

    section Deployment
    Production release       :d1, after c3, 3d
```

### With Milestones

```mermaid
gantt
    title Sprint Planning
    dateFormat YYYY-MM-DD

    section Sprint 1
    Feature A          :done, a1, 2024-01-01, 5d
    Feature B          :active, a2, after a1, 7d
    Sprint 1 Review    :milestone, m1, after a2, 0d

    section Sprint 2
    Feature C          :crit, b1, after m1, 10d
    Feature D          :b2, after m1, 8d
    Sprint 2 Review    :milestone, m2, after b1, 0d
```

---

## Pie Charts

### Basic Pie Chart

```mermaid
pie title Browser Market Share
    "Chrome" : 65
    "Safari" : 19
    "Firefox" : 8
    "Edge" : 5
    "Other" : 3
```

### Development Time Distribution

```mermaid
pie showData
    title Time Spent on Project
    "Coding" : 45
    "Testing" : 25
    "Documentation" : 15
    "Meetings" : 10
    "Review" : 5
```

---

## Quadrant Chart

### Priority Matrix

```mermaid
quadrantChart
    title Priority Matrix
    x-axis Low --> High Effort
    y-axis Low --> High Impact
    quadrant-1 Plan
    quadrant-2 Do First
    quadrant-3 Delegate
    quadrant-4 Drop

    A: [0.2, 0.8]
    B: [0.7, 0.9]
    C: [0.3, 0.3]
    D: [0.8, 0.2]
    E: [0.5, 0.6]
```

---

## Git Graph

### Basic Git Flow

```mermaid
gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Dev work"
    branch feature
    checkout feature
    commit id: "Feature 1"
    commit id: "Feature 2"
    checkout develop
    merge feature
    checkout main
    merge develop tag: "v1.0"
    commit id: "Hotfix"
```

### Complex Git History

```mermaid
gitGraph
    commit id: "init"
    branch develop
    commit id: "setup"
    branch feature-a
    commit id: "feat-a-1"
    commit id: "feat-a-2"
    checkout develop
    branch feature-b
    commit id: "feat-b-1"
    checkout feature-a
    commit id: "feat-a-3"
    checkout develop
    merge feature-a
    checkout feature-b
    commit id: "feat-b-2"
    checkout develop
    merge feature-b
    checkout main
    merge develop tag: "v1.0.0"
```

---

## Mindmaps

### Project Overview

```mermaid
mindmap
    root((Merview))
        Features
            Markdown
                GFM Support
                Tables
                Code Blocks
            Mermaid
                All Diagram Types
                Live Preview
                Theme Support
            Export
                PDF
                Print
        Technology
            Frontend
                Vanilla JS
                CodeMirror
                marked.js
            Security
                DOMPurify
                CSP
                No Backend
        Design
            Themes
                37 Styles
                Code Themes
                Mermaid Themes
```

---

## Timeline

### Project History

```mermaid
timeline
    title Merview Development Timeline

    Nov 21 : Initial Release
           : Markdown + Mermaid v1.0

    Nov 27-30 : Security Hardening
              : SRI, CSP, XSS prevention
              : AGPL licensing
              : Test infrastructure

    Dec 1-7 : Core Features
            : Session management
            : Lint panel
            : Editor themes

    Dec 8-14 : Polish
             : Fullscreen mode
             : Performance tuning
             : Bug fixes

    Dec 15-18 : Quality
              : Comprehensive test suite
              : Accessibility docs
              : Mermaid test coverage
```

---

## Sankey Diagram

### Energy Flow

```mermaid
sankey-beta

Source A,Process 1,100
Source A,Process 2,50
Source B,Process 1,30
Source B,Process 3,70
Process 1,Output X,80
Process 1,Output Y,50
Process 2,Output X,30
Process 2,Output Z,20
Process 3,Output Y,40
Process 3,Output Z,30
```

---

## XY Chart

### Line Chart

```mermaid
xychart-beta
    title "Sales Performance"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue (K)" 0 --> 100
    line [30, 45, 60, 55, 70, 85]
    bar [25, 40, 55, 50, 65, 80]
```

---

## Block Diagrams

### System Architecture

```mermaid
block-beta
    columns 3

    block:client:1
        columns 1
        Browser
        Mobile
    end

    space

    block:server:1
        columns 1
        API
        DB[(Database)]
    end

    client --> server
```

---

## Edge Cases

### Special Characters in Labels

Testing proper escaping and rendering:

```mermaid
graph LR
    A["Quotes: 'single' and \"double\""] --> B["Angle brackets: <html>"]
    B --> C["Ampersand: A & B"]
    C --> D["Unicode: 日本語 中文"]
```

### Very Long Labels

```mermaid
graph TD
    A["This is a very long label that should wrap properly and not break the layout of the diagram"] --> B["Short"]
    B --> C["Another extremely long label to test how the rendering engine handles overflow and text wrapping in foreignObject elements"]
```

### Empty and Minimal Diagrams

```mermaid
graph LR
    A --> B
```

### Deeply Nested Subgraphs

```mermaid
graph TD
    subgraph Level1[Level 1]
        subgraph Level2[Level 2]
            subgraph Level3[Level 3]
                A[Deep Node]
            end
            B[L2 Node]
        end
        C[L1 Node]
    end
    D[Root] --> Level1
    A --> B
    B --> C
```

### Multiple Edge Labels on Same Connection

```mermaid
graph LR
    A[Source] -->|"Label 1"| B[Middle]
    A -->|"Label 2"| B
    B -->|"Output"| C[End]
```

### Styling with Classes and IDs

```mermaid
graph TD
    A[Node A]:::classA --> B[Node B]:::classB
    B --> C[Node C]:::classC

    classDef classA fill:#ff9,stroke:#333,stroke-width:2px
    classDef classB fill:#9ff,stroke:#333,stroke-width:2px
    classDef classC fill:#f9f,stroke:#333,stroke-width:2px
```

### Links with Different Arrow Types

```mermaid
graph LR
    A --> B
    B --- C
    C -.-> D
    D ==> E
    E --o F
    F --x G
    G <--> H
    H o--o I
    I x--x J
```

### Malformed Diagrams (Error Handling Tests)

These intentionally malformed diagrams test the renderer's error handling:

**Missing arrow (syntax error):**

```mermaid
graph LR
    A[Start]
    B[End]
    A B
```

**Invalid diagram type:**

```mermaid
invalidtype
    A --> B
```

**Unclosed subgraph:**

```mermaid
graph TD
    subgraph Unclosed
        A --> B
```

> **Expected behavior:** Malformed diagrams should either display an error message or gracefully fail without breaking the page. The renderer should continue processing subsequent diagrams.

---

## Accessibility

SVG diagrams generated by Mermaid have inherent accessibility limitations. While they provide rich visual information, additional effort is required to make them accessible to all users.

### Screen Reader Support

SVG diagrams are primarily visual representations and are not inherently accessible to screen readers. Without additional context, users relying on assistive technology may not understand the diagram's purpose, structure, or relationships. Mermaid-generated SVGs include some basic ARIA attributes, but these alone are not sufficient for full accessibility.

### ARIA Attributes

Mermaid automatically adds accessibility-related attributes to generated SVGs:

- `role="graphics-document"` - Identifies the SVG as a graphical document
- `aria-roledescription` - Provides a description of the diagram type (e.g., "flowchart", "sequence diagram")
- `aria-label` - May include the diagram title if specified

However, these attributes do not convey the detailed information within the diagram, such as node relationships, flow direction, or specific content.

### Text Alternatives (Critical)

Always provide descriptive text before or after diagrams. This is the most important accessibility practice for complex visual content.

**Recommended pattern:**


**Diagram description:** This flowchart shows the user authentication process. Users start at the Login page, where credentials are validated. If valid, users proceed to the Dashboard. If invalid, an error message is displayed and users return to the Login page with the option to reset their password.

```
graph LR
    A[Login] --> B{Valid?}
    B -->|Yes| C[Dashboard]
    B -->|No| D[Error]
    D --> A
    D --> E[Reset Password]
```

```mermaid
graph LR
    A[Login] --> B{Valid?}
    B -->|Yes| C[Dashboard]
    B -->|No| D[Error]
    D --> A
    D --> E[Reset Password]
```

### Keyboard Navigation

Clickable nodes in Mermaid diagrams should be keyboard accessible:

- **Tab navigation**: Users should be able to tab through clickable nodes
- **Enter/Space activation**: Pressing Enter or Space should activate links
- **Visual focus indicators**: Focused nodes should have visible outlines

Test keyboard navigation on diagrams with click events (see [Clickable Flowchart](#clickable-flowchart) example).

### Color Contrast

Color contrast in diagrams depends on the active Mermaid theme:

- **Default themes**: May not meet WCAG AA contrast ratios (4.5:1 for text)
- **Dark themes**: Often have better contrast for text on dark backgrounds
- **Custom styling**: Use high-contrast colors when defining custom classes

**Considerations:**

- Avoid relying solely on color to convey information
- Use patterns, labels, or text in addition to color coding
- Test diagrams with color blindness simulators

### Recommendations for Authors

When creating Mermaid diagrams, follow these best practices:

1. **Provide text descriptions**: Always include a paragraph explaining the diagram's purpose and key information
2. **Use meaningful labels**: Node labels should be descriptive and self-explanatory
3. **Keep it simple**: Complex diagrams are harder to understand for everyone
4. **Offer alternatives**: For very complex diagrams, consider providing:
   - A simplified version
   - A bulleted text outline of the information
   - A table showing relationships
5. **Use high-contrast themes**: Select Mermaid themes with better visibility
6. **Add diagram titles**: Use Mermaid's title syntax when available
7. **Test with assistive technology**: If possible, test with screen readers

### Example: Accessible Diagram Pattern


**Purpose:** This sequence diagram illustrates the authentication flow for our application.

**Key steps:**
1. User submits credentials to the server
2. Server validates against the database
3. Database returns validation result
4. Server responds with either a success token or error message

```
sequenceDiagram
    participant User
    participant Server
    participant Database

    User->>Server: Submit credentials
    Server->>Database: Validate
    Database-->>Server: Result
    alt Valid
        Server-->>User: Success token
    else Invalid
        Server-->>User: Error message
    end
```

```mermaid
sequenceDiagram
    participant User
    participant Server
    participant Database

    User->>Server: Submit credentials
    Server->>Database: Validate
    Database-->>Server: Result
    alt Valid
        Server-->>User: Success token
    else Invalid
        Server-->>User: Error message
    end
```


**Outcome:** Users with valid credentials receive an authentication token, while invalid attempts result in an error message prompting retry.


### Accessibility Test Checklist

Use this checklist when adding or reviewing Mermaid diagrams:

| Accessibility Feature | Status | Notes |
|----------------------|--------|-------|
| Text description provided before/after diagram | | Explain diagram purpose and key information |
| Node labels are descriptive and meaningful | | Avoid abbreviations or unclear terms |
| Clickable nodes are keyboard accessible | | Test with Tab and Enter keys |
| Color contrast meets WCAG guidelines | | Test with contrast checker tools |
| Diagram has a clear title (if applicable) | | Use Mermaid title syntax |
| Alternative text format provided for complex diagrams | | Consider table or bullet list |
| Tested with screen reader (optional) | | Verify ARIA attributes and text alternatives |
| Does not rely solely on color to convey information | | Use labels, patterns, or text |

---

## Browser Compatibility

### Supported Browsers

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✓ Fully supported | Recommended for development |
| Edge | 90+ (Chromium) | ✓ Fully supported | Same engine as Chrome |
| Firefox | 88+ | ✓ Fully supported | Excellent SVG support |
| Safari | 14+ | ✓ Fully supported | Minor SVG foreignObject quirks in older versions |
| iOS Safari | 14+ | ✓ Supported | Touch interactions work well |
| Chrome Android | 90+ | ✓ Supported | May need zoom for complex diagrams |
| IE11 | - | ✗ Not supported | Mermaid 11.x requires ES2020+ |

### Mermaid Version Compatibility

**Current Version:** 11.12.2 (Updated in PR #329)

| Feature | Minimum Version | Status |
|---------|----------------|--------|
| Core diagram types | 11.0.0+ | Stable |
| Block diagrams | 11.0.0+ | Beta (block-beta) |
| Sankey diagrams | 11.0.0+ | Beta (sankey-beta) |
| XY charts | 11.0.0+ | Beta (xychart-beta) |
| Timeline | 11.0.0+ | Stable |

**Note:** Beta diagram types may have syntax changes in future releases.

### Known Limitations

- **Performance:** Pages with 40+ diagrams may experience slower initial render times
- **Large diagrams:** Complex diagrams with many nodes may require scrolling or zooming on mobile
- **Beta syntax:** Block, Sankey, and XY chart syntaxes are subject to change
- **Memory usage:** Multiple large sequence or class diagrams can increase memory footprint

### Rendering Engine Details

Mermaid uses a modern SVG-based rendering approach:

- **SVG with foreignObject:** Edge labels and HTML content use foreignObject elements
- **CSS styling:** Diagrams use external CSS classes, not inline styles
- **JavaScript required:** Client-side rendering requires JS enabled
- **Theme integration:** Supports CSS custom properties for theming

**Security:** All diagram content is sanitized through DOMPurify before rendering (see [Security docs](/?url=docs/security.md)).

---

## Regression Test Checklist

Use this checklist when testing after renderer changes:

| Test | Expected Result |
|------|-----------------|
| Edge labels visible | Labels should have background color |
| Clickable nodes work | Clicking navigates to target URL |
| Style tags preserved | CSS classes apply correctly |
| foreignObject intact | HTML content renders in labels |
| Subgraphs render | Nested groups display properly |
| Special chars escape | No XSS, chars display correctly |
| All diagram types work | No render errors in console |

---

## Navigation

- [← Back to Demos](/?url=docs/demos/index.md)
- [Welcome](/?sample)
- [About](/?url=docs/about.md)

---

*Last updated: December 2024 | Tests Mermaid v11.x rendering*
