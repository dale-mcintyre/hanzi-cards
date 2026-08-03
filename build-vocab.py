import os
import pandas as pd
import requests
from bs4 import BeautifulSoup
import json

def load_hsk_data():
    """Scrapes HSK levels 1-6 from Greg Hewgill's site."""
    hsk_dict = {}
    print("Fetching HSK vocabulary lists from Hewgill...")
    for level in range(1, 7):
        url = f"https://hewgill.com/hsk/hsk{level}.html"
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            for tr in soup.find_all('tr')[1:]: # Skip header row
                cols = [td.text.strip() for td in tr.find_all('td')]
                if len(cols) >= 3:
                    word = cols[1]
                    pinyin = cols[2]
                    definition = cols[3] if len(cols) > 3 else ""
                    hsk_dict[word] = {
                        "hsk_level": level,
                        "pinyin": pinyin,
                        "definition": definition
                    }
    return hsk_dict

def process_vocabulary():
    excel_path = 'SUBTLEX-CH-WF.xlsx'
    if not os.path.exists(excel_path):
        print(f"Error: Could not find '{excel_path}' in the root folder.")
        return

    print("Loading SUBTLEX-CH dataset (skipping metadata rows)...")
    df = pd.read_excel(excel_path, skiprows=2)
    
    # Standardize column names
    df = df.rename(columns={'Word': 'word', 'W/million': 'freq_per_million'})

    # Fetch HSK metadata
    hsk_data = load_hsk_data()

    # Initialize new columns
    df['hsk_level'] = None
    df['pinyin'] = ""
    df['definition'] = ""

    print("Merging HSK definitions and Pinyin into SUBTLEX data...")
    for idx, row in df.iterrows():
        w = row['word']
        if w in hsk_data:
            df.at[idx, 'hsk_level'] = hsk_data[w]['hsk_level']
            df.at[idx, 'pinyin'] = hsk_data[w]['pinyin']
            df.at[idx, 'definition'] = hsk_data[w]['definition']

    # Assign a frequency rank based on current order
    df['freq_rank'] = range(1, len(df) + 1)

    print(f"Total rows before filtering: {len(df)}")

    # Sense-check filter: Keep row if it has an HSK level OR its frequency rank is <= 5000
    filtered_df = df[(df['hsk_level'].notnull()) | (df['freq_rank'] <= 5000)]
    
    print(f"Total rows after filtering (Top 5000 + HSK): {len(filtered_df)}")

    # Ensure public folder exists and save the unified JSON file
    os.makedirs('public', exist_ok=True)
    json_output_path = os.path.join('public', 'unified_vocab.json')
    output_data = filtered_df.to_dict(orient='records')
    
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Success! Unified vocabulary saved to {json_output_path}")

    # Also export to CSV so it opens easily in Google Sheets
    csv_output_path = os.path.join('public', 'unified_vocab.csv')
    filtered_df.to_csv(csv_output_path, index=False, encoding='utf-8-sig')
    print(f"Spreadsheet version saved to {csv_output_path}")

if __name__ == '__main__':
    process_vocabulary()