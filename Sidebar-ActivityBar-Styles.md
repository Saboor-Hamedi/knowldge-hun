# Sidebar and ActivityBar Styling & Customization

This update introduces comprehensive UI enhancements and customization options for the Sidebar and Activity Bar.

## Features

### 1. Visual Hierarchy

- **Indentation Guides**: Nested folders in the sidebar now display clear vertical lines (indentation guides) to indicate depth.
- **Consistent Styling**: Guides are rendered dynamically based on nesting level, ensuring perfect alignment.

### 2. Customization (Settings)

New dedicated tabs in the **Settings** view allow for full personalization:

#### Sidebar Settings

- **Background Color**: Set the base background.
- **Border Color**: Customize the divider color.
- **Text Color**: Change the color of file/folder names.
- **Active Item Color**: Highlight color for the selected file.
- **Active Text Color**: Text color for the selected file.
- **Font Size**: Adjust the text size (px).

#### Activity Bar Settings

- **Background Color**: Set the bar's background.
- **Border Color**: Customize the border.
- **Active Item Color**: Background for the active view icon.
- **Active Icon Color**: Color of the active icon.
- **Inactive Icon Color**: Color of inactive icons.

## Implementation Details

- **CSS Variables**: All styles use CSS variables (e.g., `--sidebar-bg`, `--activity-bg`) for overriding defaults.
- **Dynamic Application**: Changes in settings are applied immediately via `SidebarTree.applyStyles` and `ActivityBar.render`.
- **Persistence**: Settings are saved to `state.settings` and persisted to the backend.

## Usage

1. Open **Settings** (Ctrl+,).
2. Navigate to the **Sidebar** or **Activity Bar** tab.
3. Use the color pickers and inputs to adjust the appearance.
