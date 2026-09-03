*** Settings ***
Documentation     Smoke tests for ForgeAppHelp
...               Verifies basic UI functionality using Browser library (Playwright)
Library           Browser
Suite Setup       Open Browser To App
Suite Teardown    Close Browser

*** Variables ***
${BASE_URL}       %{BASE_URL=http://localhost:8000}
${BROWSER}        chromium
${HEADLESS}       true

*** Keywords ***
Open Browser To App
    [Documentation]    Opens a headless browser and navigates to the app
    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Page       ${BASE_URL}
    Wait For Elements State    [data-testid="app-root"]    visible    timeout=10s

*** Test Cases ***
App Root Should Be Visible
    [Documentation]    Verify the main app container loads correctly
    [Tags]    smoke    critical
    Get Element States    [data-testid="app-root"]    contains    visible

Primary Action Button Should Be Clickable
    [Documentation]    Verify the primary action button exists and responds to clicks
    [Tags]    smoke    interaction
    Wait For Elements State    [data-testid="primary-action"]    visible
    Click    [data-testid="primary-action"]
    
Panel Should Appear After Primary Action
    [Documentation]    Verify clicking primary action reveals the panel
    [Tags]    smoke    interaction
    # Ensure we're starting from a clean state
    Go To    ${BASE_URL}
    Wait For Elements State    [data-testid="app-root"]    visible
    
    # Panel should not be visible initially (display: none)
    ${panel_visible}=    Get Element States    [data-testid="panel"]
    Should Not Contain    ${panel_visible}    visible
    
    # Click primary action
    Click    [data-testid="primary-action"]
    
    # Panel should now be visible
    Wait For Elements State    [data-testid="panel"]    visible    timeout=5s

Page Title Should Be Present
    [Documentation]    Verify the page has a title
    [Tags]    smoke    seo
    ${title}=    Get Title
    Should Not Be Empty    ${title}
